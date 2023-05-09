import type { EventHandler, FormEvent } from "react";

export const preventDefault: EventHandler<FormEvent> = (e) => e.preventDefault();
