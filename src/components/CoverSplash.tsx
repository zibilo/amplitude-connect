import { useEffect, useState } from 'react';

const STORAGE_KEY = 'mucodec_cover_seen';

export function CoverSplash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setShow(true);
      localStorage.setItem(STORAGE_KEY, '1');
      const t = setTimeout(() => setShow(false), 3500);
      return () => clearTimeout(t);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="cover-splash" onClick={() => setShow(false)}>
      <style>{`
        .cover-splash {
          position: fixed; inset: 0; z-index: 9999;
          background: #ffffff; overflow: hidden;
          font-family: "Segoe UI", Roboto, sans-serif;
          animation: cover-fade-out 0.6s ease-in 3s forwards;
        }
        @keyframes cover-fade-out { to { opacity: 0; visibility: hidden; } }
        .cover-splash .waves-container {
          position: absolute; bottom: 0; left: 0; width: 100%; height: 25vh; z-index: 1;
        }
        .cover-splash .wave {
          position: absolute; bottom: 0; left: 0; width: 200%; height: 100%;
          background-repeat: repeat-x; background-position: 0 bottom;
        }
        .cover-splash .wave-blue {
          background-image: url('data:image/svg+xml;utf8,<svg viewBox="0 0 1200 120" xmlns="http://www.w3.org/2000/svg"><path d="M0 30L48 33.7C96 37 192 45 288 52.5C384 60 480 68 576 63.8C672 60 768 45 864 41.2C960 38 1056 45 1104 48.8L1152 52.5V120H0V30Z" fill="%23002266" fill-opacity="0.25"/></svg>');
          animation: cover-move-wave 12s linear infinite;
        }
        .cover-splash .wave-red {
          background-image: url('data:image/svg+xml;utf8,<svg viewBox="0 0 1200 120" xmlns="http://www.w3.org/2000/svg"><path d="M0 50L48 45C96 40 192 30 288 33.8C384 38 480 55 576 58.8C672 63 768 53 864 45C960 38 1056 33 1104 30L1152 27.5V120H0V50Z" fill="%23E30613" fill-opacity="0.18"/></svg>');
          animation: cover-move-wave 8s linear infinite reverse;
        }
        @keyframes cover-move-wave { 0% { transform: translateX(0);} 100% { transform: translateX(-50%);} }
        .cover-splash .page-wrapper {
          position: relative; z-index: 2;
          display: flex; flex-direction: column; justify-content: center; align-items: center;
          height: 100vh;
        }
        .cover-splash .text-mucodec {
          color: #002266; font-weight: bold; font-size: 68px; letter-spacing: -1px;
          font-family: "Palatino Linotype", "Book Antiqua", Palatino, serif;
          opacity: 0; transform: translateY(10px);
          animation: cover-fade-in 1s ease-out forwards; animation-delay: 0.4s;
        }
        @keyframes cover-fade-in { to { opacity: 1; transform: translateY(0);} }
        .cover-splash .floating { animation: cover-float 4s ease-in-out infinite; }
        @keyframes cover-float { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-10px);} }
        .cover-splash .loader-windows {
          position: relative; width: 50px; height: 50px; margin-top: 30px; opacity: 0;
          animation: cover-fade-in 0.5s ease-out forwards; animation-delay: 1.4s;
        }
        .cover-splash .loader-windows .dot {
          position: absolute; width: 100%; height: 100%; opacity: 0;
          transform: rotate(225deg); animation: cover-orbit 5.5s infinite;
        }
        .cover-splash .loader-windows .dot::after {
          content: ''; position: absolute; width: 6px; height: 6px;
          background: #a0a0a0; border-radius: 50%;
        }
        .cover-splash .loader-windows .dot:nth-child(2) { animation-delay: 240ms; }
        .cover-splash .loader-windows .dot:nth-child(3) { animation-delay: 480ms; }
        .cover-splash .loader-windows .dot:nth-child(4) { animation-delay: 720ms; }
        .cover-splash .loader-windows .dot:nth-child(5) { animation-delay: 960ms; }
        @keyframes cover-orbit {
          0% { transform: rotate(225deg); opacity: 1; animation-timing-function: ease-out; }
          7% { transform: rotate(345deg); animation-timing-function: linear; }
          30% { transform: rotate(455deg); animation-timing-function: ease-in-out; }
          39% { transform: rotate(570deg); animation-timing-function: linear; }
          70% { transform: rotate(815deg); opacity: 1; animation-timing-function: ease-out; }
          75% { transform: rotate(945deg); animation-timing-function: ease-out; }
          76% { transform: rotate(945deg); opacity: 0; }
          100% { transform: rotate(945deg); opacity: 0; }
        }
      `}</style>
      <div className="waves-container">
        <div className="wave wave-blue" />
        <div className="wave wave-red" />
      </div>
      <div className="page-wrapper">
        <div className="floating">
          <div className="text-mucodec">MUCODEC</div>
        </div>
        <div className="loader-windows">
          <div className="dot" />
          <div className="dot" />
          <div className="dot" />
          <div className="dot" />
          <div className="dot" />
        </div>
      </div>
    </div>
  );
}