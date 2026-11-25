import { useState, useRef, useCallback } from 'react';

function getWsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/deepgram`;
}

export default function VoiceButton({ onTranscript, onError }) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ws = new WebSocket(getWsUrl());
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.error) {
            onError?.('Balss savienojuma kļūda');
            return;
          }
          const transcript = msg.channel?.alternatives?.[0]?.transcript;
          if (!transcript) return;
          onTranscript(transcript, Boolean(msg.is_final));
        } catch {
          // ignore non-JSON messages
        }
      });

      ws.addEventListener('error', () => {
        onError?.('Balss savienojuma kļūda');
        stop();
      });

      ws.addEventListener('close', () => {
        stop();
      });

      ws.addEventListener('open', () => {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        // Send each chunk as binary (ArrayBuffer), keeping chunk order.
        let sendQueue = Promise.resolve();
        recorder.addEventListener('dataavailable', (e) => {
          if (e.data.size === 0) return;
          sendQueue = sendQueue
            .then(() => e.data.arrayBuffer())
            .then((buf) => {
              if (ws.readyState === WebSocket.OPEN) ws.send(buf);
            })
            .catch(() => {});
        });

        recorder.start(250); // send chunks every 250ms
        setRecording(true);
      });
    } catch (err) {
      onError?.('Nav piekļuves mikrofonam');
      stop();
    }
  }, [onTranscript, onError, stop]);

  const toggle = () => {
    if (recording) {
      stop();
    } else {
      start();
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={recording ? 'Apturēt ierakstu' : 'Sākt balss ierakstu'}
      className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-colors duration-200 ${
        recording
          ? 'bg-accent hover:bg-pink-600'
          : 'bg-navy-light hover:bg-primary/30 border border-white/20'
      }`}
    >
      {recording && (
        <span className="absolute inset-0 rounded-full bg-accent/40 animate-ping" />
      )}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-5 h-5 text-white relative z-10"
      >
        {recording ? (
          <rect x="6" y="6" width="12" height="12" rx="2" />
        ) : (
          <path d="M12 1a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Zm7 10a7 7 0 0 1-6 6.93V21h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-3.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0 1 1 0 1 1 2 0Z" />
        )}
      </svg>
    </button>
  );
}
