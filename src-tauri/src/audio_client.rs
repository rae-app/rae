use std::sync::{Arc, Mutex};
use std::time::Duration;
use futures_util::{SinkExt, StreamExt};
use tokio::time::interval;
use tokio_tungstenite::connect_async;
use tungstenite::protocol::Message;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde_json::json;
use base64::{Engine, engine::general_purpose};
use tauri::{AppHandle, Emitter};
use tracing::{info, error, debug};

pub struct AudioState;

static AUDIO_CLIENT_RUNNING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

// Convert f32 samples to 16-bit PCM (matching React floatTo16BitPCM)
fn float_to_16bit_pcm(input: &[f32]) -> Vec<u8> {
    let mut output = Vec::with_capacity(input.len() * 2);
    for &sample in input {
        let clamped = sample.clamp(-1.0, 1.0);
        let pcm_val = if clamped < 0.0 {
            (clamped * 32768.0) as i16
        } else {
            (clamped * 32767.0) as i16
        };
        output.extend_from_slice(&pcm_val.to_le_bytes());
    }
    output
}

// Downsample buffer (matching React downsampleBuffer)
fn downsample_buffer(buffer: &[f32], sample_rate: u32, out_sample_rate: u32) -> Vec<f32> {
    if out_sample_rate == sample_rate {
        return buffer.to_vec();
    }

    let sample_rate_ratio = sample_rate as f32 / out_sample_rate as f32;
    let new_length = (buffer.len() as f32 / sample_rate_ratio).round() as usize;
    let mut result = vec![0.0; new_length];

    for i in 0..new_length {
        let start = (i as f32 * sample_rate_ratio) as usize;
        let end = ((i + 1) as f32 * sample_rate_ratio) as usize;
        let end = end.min(buffer.len());

        if start < buffer.len() {
            let mut sum = 0.0;
            let mut count = 0;
            for j in start..end {
                sum += buffer[j];
                count += 1;
            }
            result[i] = if count > 0 { sum / count as f32 } else { 0.0 };
        }
    }

    result
}

// Base64 encode audio (matching React base64EncodeAudio)
fn base64_encode_audio(buffer: &[u8]) -> String {
    general_purpose::STANDARD.encode(buffer)
}

pub async fn run_audio_client(app_handle: AppHandle) {
    if AUDIO_CLIENT_RUNNING.load(std::sync::atomic::Ordering::Relaxed) {
        println!("⚠️ Audio client already running");
        return;
    }

    println!("🎤 Starting system audio capture...");

    // Connect to WebSocket (matching React WebSocket connection)
    let url = "ws://localhost:8000/ws/realtime";
    let (ws_stream, _) = match connect_async(url).await {
        Ok((stream, response)) => {
            info!("WebSocket connected to {}", url);
            (stream, response)
        }
        Err(e) => {
            error!("Failed to connect to WebSocket: {}", e);
            return;
        }
    };

    AUDIO_CLIENT_RUNNING.store(true, std::sync::atomic::Ordering::Relaxed);
    let (write, mut read) = ws_stream.split();

    // Audio buffer (matching React bufferRef pattern)
    let buffer: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));

    // Set up system audio capture
    let host = cpal::default_host();
    let device = match host.default_output_device() {
        Some(device) => {
            info!("Using system audio device: {}", device.name().unwrap_or("Unknown".to_string()));
            device
        }
        None => {
            error!("No system audio device available");
            AUDIO_CLIENT_RUNNING.store(false, std::sync::atomic::Ordering::Relaxed);
            return;
        }
    };

    let config = match device.default_output_config() {
        Ok(config) => config,
        Err(e) => {
            error!("Failed to get device config: {}", e);
            AUDIO_CLIENT_RUNNING.store(false, std::sync::atomic::Ordering::Relaxed);
            return;
        }
    };

    let sample_rate = config.sample_rate().0;
    info!("Audio config: {} channels, {} Hz, {:?}", config.channels(), sample_rate, config.sample_format());

    // Create audio stream (matching React audio processing)
    let buffer_clone = buffer.clone();
    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => device.build_input_stream(
            &config.into(),
            move |data: &[f32], _| {
                let mut buf = buffer_clone.lock().unwrap();
                buf.extend_from_slice(data);
            },
            move |err| error!("Stream error: {:?}", err),
            None,
        ),
        _ => {
            error!("Unsupported format: {:?}", config.sample_format());
            AUDIO_CLIENT_RUNNING.store(false, std::sync::atomic::Ordering::Relaxed);
            return;
        }
    };

    let stream = match stream {
        Ok(s) => s,
        Err(e) => {
            error!("Failed to build audio stream: {}", e);
            AUDIO_CLIENT_RUNNING.store(false, std::sync::atomic::Ordering::Relaxed);
            return;
        }
    };

    if let Err(e) = stream.play() {
        error!("Failed to start audio stream: {}", e);
        AUDIO_CLIENT_RUNNING.store(false, std::sync::atomic::Ordering::Relaxed);
        return;
    }

    println!("✅ System audio capture started");

    // Send audio every 200ms (matching React pattern exactly)
    let buffer_clone = buffer.clone();
    let mut write_clone = write;
    tokio::spawn(async move {
        let mut interval = interval(Duration::from_millis(200));

        while AUDIO_CLIENT_RUNNING.load(std::sync::atomic::Ordering::Relaxed) {
            interval.tick().await;

            // Get buffered audio (matching React sendBufferedAudio)
            let audio_data = {
                let mut buf = buffer_clone.lock().unwrap();
                if buf.is_empty() {
                    continue;
                }
                let data = buf.clone();
                buf.clear();
                data
            };

            // Process audio exactly like React:
            // 1. Downsample to 24kHz
            let downsampled = downsample_buffer(&audio_data, sample_rate, 24000);

            // 2. Convert to 16-bit PCM
            let pcm_buffer = float_to_16bit_pcm(&downsampled);

            // 3. Base64 encode
            let base64_audio = base64_encode_audio(&pcm_buffer);

            // 4. Send as JSON (matching React WebSocket send)
            let message = json!({ "audio": base64_audio });

            if let Err(e) = write_clone.send(Message::text(message.to_string())).await {
                error!("Failed to send audio data: {}", e);
                AUDIO_CLIENT_RUNNING.store(false, std::sync::atomic::Ordering::Relaxed);
                break;
            }
        }
        println!("🔇 Audio sending stopped");
    });

    // Handle WebSocket messages (matching React onmessage handler)
    while let Some(msg) = read.next().await {
        if !AUDIO_CLIENT_RUNNING.load(std::sync::atomic::Ordering::Relaxed) {
            break;
        }

        match msg {
            Ok(Message::Text(txt)) => {
                if let Ok(data) = serde_json::from_str::<serde_json::Value>(&txt) {
                    match data["type"].as_str() {
                        Some("response.text.delta") => {
                            let delta_text = data["delta"].as_str().unwrap_or("");
                            debug!("Audio delta: {}", delta_text);
                            let response_data = json!({
                                "type": "response.text.delta",
                                "delta": delta_text
                            });
                            let _ = app_handle.emit("audio_response", response_data);
                        }
                        Some("response.text.done") => {
                            let final_text = data["text"].as_str().unwrap_or("");
                            debug!("Audio final: {}", final_text);
                            let response_data = json!({
                                "type": "response.text.done",
                                "text": final_text
                            });
                            let _ = app_handle.emit("audio_response", response_data);
                        }
                        Some("error") => {
                            error!("Backend error: {}", data["error"]);
                        }
                        _ => {}
                    }
                }
            }
            Ok(_) => {}
            Err(e) => {
                error!("WebSocket error: {}", e);
                break;
            }
        }
    }

    // Cleanup
    AUDIO_CLIENT_RUNNING.store(false, std::sync::atomic::Ordering::Relaxed);
    println!("🔇 Audio client stopped");
}

#[tauri::command]
pub async fn start_audio_client(app_handle: AppHandle) -> Result<String, String> {
    if AUDIO_CLIENT_RUNNING.load(std::sync::atomic::Ordering::Relaxed) {
        return Ok("Audio client already running".to_string());
    }

    tokio::spawn(async move {
        run_audio_client(app_handle).await;
    });

    Ok("Audio client started".to_string())
}

#[tauri::command]
pub async fn stop_audio_client() -> Result<String, String> {
    if AUDIO_CLIENT_RUNNING.load(std::sync::atomic::Ordering::Relaxed) {
        AUDIO_CLIENT_RUNNING.store(false, std::sync::atomic::Ordering::Relaxed);
        println!("🛑 Stopping audio client...");
        Ok("Audio client stopped".to_string())
    } else {
        Ok("Audio client was not running".to_string())
    }
}

#[tauri::command]
pub async fn is_audio_client_running() -> Result<bool, String> {
    Ok(AUDIO_CLIENT_RUNNING.load(std::sync::atomic::Ordering::Relaxed))
}
