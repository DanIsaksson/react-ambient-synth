export interface AudioMessage {
    target: string; // Node ID (e.g., "osc_1")
    action: string; // Method (e.g., "set_param")
    payload: any;   // Value (e.g., { param: "frequency", value: 440 })
    time?: number;  // Scheduled time (optional)
}
