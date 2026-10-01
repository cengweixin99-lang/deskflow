import { Copy, Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import "./WindowControls.css";

interface WindowControlsProps {
  disabled: boolean;
}

export function WindowControls({ disabled }: WindowControlsProps) {
  const [maximized, setMaximized] = useState(true);

  useEffect(() => {
    let mounted = true;
    const removeListener = window.desktop.onWindowMaximizedChange(setMaximized);
    void window.desktop.isWindowMaximized()
      .then((value) => {
        if (mounted) setMaximized(value);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
      removeListener();
    };
  }, []);

  return (
    <div className={`window-controls${disabled ? " modal-active" : ""}`} role="group" aria-label="窗口控制">
      <button className="window-control-button" type="button" disabled={disabled} onClick={() => window.desktop.minimizeWindow()} aria-label="最小化窗口" title="最小化">
        <Minus size={15} strokeWidth={1.6} />
      </button>
      <button className="window-control-button" type="button" disabled={disabled} onClick={() => window.desktop.toggleMaximizeWindow()} aria-label={maximized ? "还原窗口" : "最大化窗口"} title={maximized ? "还原" : "最大化"}>
        {maximized ? <Copy size={12} strokeWidth={1.5} /> : <Square size={11} strokeWidth={1.5} />}
      </button>
      <button className="window-control-button close" type="button" disabled={disabled} onClick={() => window.desktop.closeWindow()} aria-label="关闭窗口" title="关闭">
        <X size={15} strokeWidth={1.5} />
      </button>
    </div>
  );
}
