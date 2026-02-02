type LogListener = (log: any) => void;

class LogStream {
  private listeners: LogListener[] = [];

  subscribe(listener: LogListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  write(log: any) {
    this.listeners.forEach((l) => l(log));
  }
}

export const logStream = new LogStream();
