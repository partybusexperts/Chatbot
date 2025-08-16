import { useState } from "react";

export default function QuoteBot() {
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Hi! I can help you get a party bus quote. What city are you interested in?" }
  ]);
  const [input, setInput] = useState("");
  const [form, setForm] = useState({
    city: "",
    passengers: "",
    hours: "",
    event_date: "",
    is_prom_or_dance: false,
  size_direction: "",
  zip: ""
  });
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const steps = [
    { key: "city", prompt: "What city?" },
    { key: "zip", prompt: "What zip code? (optional, press Enter to skip)" },
    { key: "passengers", prompt: "How many passengers?" },
    { key: "hours", prompt: "How many hours?" },
    { key: "event_date", prompt: "What date? (YYYY-MM-DD, optional)" },
    { key: "is_prom_or_dance", prompt: "Is this for a prom or dance? (yes/no, optional)" },
    { key: "size_direction", prompt: "Do you want a larger or smaller vehicle, or no preference? (optional)" }
  ];

  function handleSend(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = { sender: "user", text: input };
    setMessages((msgs) => [...msgs, userMsg]);
    const currentStep = steps[step];
    let value = input.trim();
    let nextForm = { ...form };
    if (currentStep.key === "is_prom_or_dance") {
      value = /yes|y/i.test(value) ? true : false;
    }
    nextForm[currentStep.key] = value;
    setForm(nextForm);
    setInput("");
    if (step < steps.length - 1) {
      setStep(step + 1);
      setMessages((msgs) => [
        ...msgs,
        { sender: "bot", text: steps[step + 1].prompt }
      ]);
    } else {
      // All info collected, call backend
      setLoading(true);
      fetch("/api/quote-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: nextForm.city,
          zip: nextForm.zip || undefined,
          passengers: Number(nextForm.passengers),
          hours: Number(nextForm.hours),
          event_date: nextForm.event_date || undefined,
          is_prom_or_dance: nextForm.is_prom_or_dance,
          size_direction: nextForm.size_direction || undefined
        })
      })
        .then((res) => res.json())
        .then((data) => {
          setLoading(false);
          if (data.options && data.options.length > 0) {
            setMessages((msgs) => [
              ...msgs,
              {
                sender: "bot",
                text: `Here are your options:\n` +
                  data.options.map(
                    (o, i) =>
                      `${i + 1}. ${o.name || "Unknown"} (${o.capacity ?? "?"} passengers, zips: ${o.zip_codes ? o.zip_codes.slice(0, 20) + (o.zip_codes.length > 20 ? '...' : '') : '?'}) : $${o.total_all_in ?? "?"} for ${o.hours_billed ?? "?"} hours`)
                    .join("\n")
              }
            ]);
          } else {
            setMessages((msgs) => [
              ...msgs,
              { sender: "bot", text: data.note || "No options found." }
            ]);
          }
        })
        .catch(() => {
          setLoading(false);
          setMessages((msgs) => [
            ...msgs,
            { sender: "bot", text: "Sorry, there was an error getting your quote." }
          ]);
        });
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>Party Bus Quote Chatbot</h2>
      <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, minHeight: 300, background: "#fafbfc" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ textAlign: msg.sender === "user" ? "right" : "left", margin: "8px 0" }}>
            <span style={{
              display: "inline-block",
              background: msg.sender === "user" ? "#0070f3" : "#eaeaea",
              color: msg.sender === "user" ? "#fff" : "#222",
              borderRadius: 16,
              padding: "8px 16px",
              maxWidth: "80%"
            }}>{msg.text}</span>
          </div>
        ))}
        {loading && <div style={{ color: "#888", marginTop: 8 }}>Getting your quote...</div>}
      </div>
      {!loading && step < steps.length && (
        <form onSubmit={handleSend} style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <input
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={steps[step].prompt}
            style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
          />
          <button type="submit" style={{ padding: "8px 16px", borderRadius: 8, background: "#0070f3", color: "#fff", border: "none" }}>Send</button>
        </form>
      )}
    </div>
  );
}
