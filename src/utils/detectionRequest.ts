import type { LanguageMode } from "./dataFormats";

export interface DetectionTicket {
  documentId: string;
  version: number;
}

/** A render invalidates replies immediately, including before effect cleanup. */
export class DetectionSession {
  private current?: {
    ticket: DetectionTicket;
    content: string;
    filename?: string;
    mode: LanguageMode;
  };
  update(
    documentId: string,
    content: string,
    mode: LanguageMode,
    filename?: string,
  ): DetectionTicket {
    const current = this.current;
    if (
      !current ||
      current.ticket.documentId !== documentId ||
      current.content !== content ||
      current.filename !== filename ||
      current.mode !== mode
    ) {
      this.current = {
        ticket: { documentId, version: (current?.ticket.version || 0) + 1 },
        content,
        filename,
        mode,
      };
    }
    return this.current!.ticket;
  }
  accepts(ticket: DetectionTicket): boolean {
    return (
      ticket.documentId === this.current?.ticket.documentId &&
      ticket.version === this.current?.ticket.version
    );
  }
}
