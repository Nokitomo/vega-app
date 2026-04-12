declare module 'ffmpeg-kit-react-native' {
  export interface FFmpegSession {
    getSessionId(): number;
    getReturnCode(): Promise<unknown>;
  }

  export interface FFmpegLog {
    getMessage(): string;
    getSessionId(): number;
  }

  export interface FFprobeSession {
    getOutput(): Promise<string>;
  }

  export const FFmpegKit: {
    executeAsync(
      command: string,
      completeCallback?: (session: FFmpegSession) => void | Promise<void>,
      logCallback?: (log: FFmpegLog) => void | Promise<void>,
    ): Promise<void>;
  };

  export const FFprobeKit: {
    getMediaInformation(url: string): Promise<FFprobeSession>;
  };

  export const ReturnCode: {
    isSuccess(code: unknown): boolean;
  };
}
