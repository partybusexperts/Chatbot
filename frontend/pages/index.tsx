// pages/index.tsx
import { useState, useEffect } from "react";


type QuoteOption = {
  name: string;
  capacity: number;
  hours_billed: number;
  hourly_rate: number;
  total_all_in: number;
  image_url?: string;
  prom_applied: boolean;
  zip_codes?: string;
};

type GroupedOptions = {
  party_buses: QuoteOption[];
  limousines: QuoteOption[];
  shuttle_buses: QuoteOption[];
};


export default function Home() {
  const [city, setCity] = useState("San Diego");
  const [passengers, setPassengers] = useState<string | number>(18);
  const [sizeDirection, setSizeDirection] = useState<"larger" | "smaller" | null>(null);
  const [hours, setHours] = useState<number>(4);
  const [eventDate, setEventDate] = useState<string>("");
  const [isProm, setIsProm] = useState<boolean>(false);

  const [zip, setZip] = useState("");
  const [groupedOptions, setGroupedOptions] = useState<GroupedOptions>({ party_buses: [], limousines: [], shuttle_buses: [] });
  const [note, setNote] = useState("");
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [splitCount, setSplitCount] = useState<number | "">("");

  // Use relative API path for production compatibility
  const API = "/api/quote";

  // Track pivot capacity for true larger/smaller paging
  const [page, setPage] = useState(0);


  async function fetchQuote(resetPage = false) {
    setLoading(true);
    setErr(null);
    setGroupedOptions({ party_buses: [], limousines: [], shuttle_buses: [] });
    setNote("");

    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          passengers: Number(passengers),
          hours: Number(hours),
          event_date: eventDate || null,
          is_prom_or_dance: isProm,
          zip: zip || null,
        }),
      });
      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      const data = await res.json();
      setRawResponse(data); // <-- debug: show raw API response
      setGroupedOptions({
        party_buses: data.party_buses || [],
        limousines: data.limousines || [],
        shuttle_buses: data.shuttle_buses || [],
      });
      setNote(data.note || "");
      setPage(0); // always reset page on new search
    } catch (e) {
      setRawResponse(e);
      if (e instanceof Error) {
        setErr(e.message);
      } else {
        setErr("Could not reach backend. Is it running on :8000?");
      }
    } finally {
      setLoading(false);
    }
  }

  function perPerson(total: number) {
    const p = (splitCount === "" ? Number(passengers) : Number(splitCount)) || 0;
    return p > 0 && total !== undefined && total !== null ? `$${(total / p).toFixed(2)}/person` : "";
  }

  function copyQuote(o: QuoteOption) {
    const lines = [
      `Quote — ${city} · ${passengers} ppl · ${hours}h${eventDate ? " · " + eventDate : ""}`,
      `${o.name} (${o.capacity} pax)`,
      `${o.prom_applied ? "Prom pricing" : "Standard pricing"}`,
      `Hourly $${o.hourly_rate !== undefined && o.hourly_rate !== null ? o.hourly_rate.toFixed(2) : "?"} · Billed ${o.hours_billed}h`,
      `Total $${o.total_all_in !== undefined && o.total_all_in !== null ? o.total_all_in.toFixed(2) : "?"}${perPerson(o.total_all_in) ? " · " + perPerson(o.total_all_in) : ""}`,
    ].join("\n");
    navigator.clipboard.writeText(lines);
    alert("Quote copied to clipboard.");
  }


  // Always reset page to 0 when options change (new search/filter)
  useEffect(() => {
    setPage(0);
  }, [groupedOptions.party_buses.length, groupedOptions.limousines.length, groupedOptions.shuttle_buses.length]);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Party Bus Quote Bot</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchQuote();
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <label className="block text-sm">City</label>
              <input
                className="w-full border p-2 rounded"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <label className="block text-sm">Zip Code (optional)</label>
              <input
                className="w-full border p-2 rounded"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
              />

              <label className="block text-sm">Passengers</label>
              <input
                className="w-full border p-2 rounded"
                type="number"
                value={passengers === 0 || passengers === "0" ? "" : passengers}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setPassengers("");
                  } else {
                    // Allow only positive integers
                    const n = Number(val);
                    if (!isNaN(n) && n > 0 && Number.isInteger(n)) setPassengers(n);
                  }
                }}
                min={1}
              />

              <label className="block text-sm">Hours (requested)</label>
              <input
                className="w-full border p-2 rounded"
                type="number"
                value={hours === 0 ? "" : hours}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setHours(0);
                  } else {
                    const n = Number(val);
                    if (!isNaN(n)) setHours(n);
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm">Event Date (YYYY-MM-DD)</label>
              <input
                className="w-full border p-2 rounded"
                placeholder="2025-04-12"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />

              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isProm}
                  onChange={(e) => setIsProm(e.target.checked)}
                />
                <span className="text-sm">Prom / Dance mentioned</span>
              </label>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-sm">Split cost by # people (optional)</label>
            <input
              className="w-40 border p-2 rounded"
              type="number"
              placeholder={`${passengers}`}
              value={splitCount as number | ""}
              onChange={(e) =>
                setSplitCount(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          </div>
          {/* Always-visible button group */}
          <div className="flex flex-wrap gap-2 pt-1 mb-4">
            <button
              type="submit"
              className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Getting options..." : "Get 3 Options"}
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-2 rounded border disabled:opacity-60"
              disabled={loading || page === 0}
            >
              ◀ Smaller
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => (groupedOptions.party_buses.length > (p + 1) * 3 ? p + 1 : p))}
              className="px-3 py-2 rounded border disabled:opacity-60"
              disabled={loading || groupedOptions.party_buses.length <= (page + 1) * 3}
            >
              Larger ▶
            </button>
          </div>
        </form>

        {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
        {/* Debug: show raw API response */}
        {rawResponse && (
          <details className="mb-2 bg-gray-100 border p-2 rounded text-xs">
            <summary>Raw API response (debug)</summary>
            <pre>{JSON.stringify(rawResponse, null, 2)}</pre>
          </details>
        )}
        {/* Show largest/smallest message in red above results, but always show vehicles */}
        {note && (note.toLowerCase().includes("largest") || note.toLowerCase().includes("smallest")) && (
          <div className="mb-4 p-3 rounded bg-red-100 border border-red-400 text-red-800 text-lg font-bold text-center">
            {note}
          </div>
        )}
        {note && !(note.toLowerCase().includes("largest") || note.toLowerCase().includes("smallest")) && (
          <p className="text-base font-semibold text-blue-700 mb-3">{note}</p>
        )}

        {groupedOptions.party_buses.length === 0 && groupedOptions.limousines.length === 0 && groupedOptions.shuttle_buses.length === 0 && !loading && (
          <div className="text-center text-lg text-red-600 font-semibold my-8">
            No vehicles found for your search.
          </div>
        )}
  <div className="grid grid-cols-3 gap-4 divide-x divide-gray-300 min-h-[400px] w-full" style={{ minWidth: 960, overflowX: 'auto' }}>
          {/* Party Buses */}
          <div className="min-w-[320px]">
            <h2 className="text-lg font-bold mb-2 text-center">Party Buses</h2>
            {groupedOptions.party_buses.length === 0 && <div className="text-gray-400 text-center">None</div>}
            {groupedOptions.party_buses.map((o) => (
              <div key={o.name} className="rounded-lg border bg-white p-4 shadow-sm mb-2">
                <div className="flex gap-4">
                  {o.image_url ? (
                    <img
                      src={o.image_url}
                      alt={o.name}
                      className="w-40 h-28 object-cover rounded"
                    />
                  ) : (
                    <div className="w-40 h-28 bg-gray-200 rounded" />
                  )}
                  <div className="flex-1">
                    <h2 className="font-semibold">
                      {o.name} · {o.capacity} pax
                    </h2>
                    <p className="text-sm text-gray-600">
                      {o.prom_applied ? "Prom pricing" : "Standard pricing"} · Hourly $
                      {o.hourly_rate !== undefined && o.hourly_rate !== null ? o.hourly_rate.toFixed(2) : "?"} · Billed {o.hours_billed}h
                    </p>
                    <p className="text-lg font-bold mt-1">
                      Total ${o.total_all_in !== undefined && o.total_all_in !== null ? o.total_all_in.toFixed(2) : "?"}{" "}
                      {perPerson(o.total_all_in) ? `· ${perPerson(o.total_all_in)}` : ""}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        className="px-3 py-1 rounded border"
                        onClick={() => copyQuote(o)}
                      >
                        Copy Quote
                      </button>
                      <button className="px-3 py-1 rounded border">Hot Lead ★</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Limousines */}
          <div className="min-w-[320px]">
            <h2 className="text-lg font-bold mb-2 text-center">Limousines</h2>
            {groupedOptions.limousines.length === 0 && <div className="text-gray-400 text-center">None</div>}
            {groupedOptions.limousines.map((o) => (
              <div key={o.name} className="rounded-lg border bg-white p-4 shadow-sm mb-2">
                <div className="flex gap-4">
                  {o.image_url ? (
                    <img
                      src={o.image_url}
                      alt={o.name}
                      className="w-40 h-28 object-cover rounded"
                    />
                  ) : (
                    <div className="w-40 h-28 bg-gray-200 rounded" />
                  )}
                  <div className="flex-1">
                    <h2 className="font-semibold">
                      {o.name} · {o.capacity} pax
                    </h2>
                    <p className="text-sm text-gray-600">
                      {o.prom_applied ? "Prom pricing" : "Standard pricing"} · Hourly $
                      {o.hourly_rate !== undefined && o.hourly_rate !== null ? o.hourly_rate.toFixed(2) : "?"} · Billed {o.hours_billed}h
                    </p>
                    <p className="text-lg font-bold mt-1">
                      Total ${o.total_all_in !== undefined && o.total_all_in !== null ? o.total_all_in.toFixed(2) : "?"}{" "}
                      {perPerson(o.total_all_in) ? `· ${perPerson(o.total_all_in)}` : ""}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        className="px-3 py-1 rounded border"
                        onClick={() => copyQuote(o)}
                      >
                        Copy Quote
                      </button>
                      <button className="px-3 py-1 rounded border">Hot Lead ★</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Shuttle/Coach Buses */}
          <div className="min-w-[320px]">
            <h2 className="text-lg font-bold mb-2 text-center">Shuttle/Coach Buses</h2>
            {groupedOptions.shuttle_buses.length === 0 && <div className="text-gray-400 text-center">None</div>}
            {groupedOptions.shuttle_buses.map((o) => (
              <div key={o.name} className="rounded-lg border bg-white p-4 shadow-sm mb-2">
                <div className="flex gap-4">
                  {o.image_url ? (
                    <img
                      src={o.image_url}
                      alt={o.name}
                      className="w-40 h-28 object-cover rounded"
                    />
                  ) : (
                    <div className="w-40 h-28 bg-gray-200 rounded" />
                  )}
                  <div className="flex-1">
                    <h2 className="font-semibold">
                      {o.name} · {o.capacity} pax
                    </h2>
                    <p className="text-sm text-gray-600">
                      {o.prom_applied ? "Prom pricing" : "Standard pricing"} · Hourly $
                      {o.hourly_rate !== undefined && o.hourly_rate !== null ? o.hourly_rate.toFixed(2) : "?"} · Billed {o.hours_billed}h
                    </p>
                    <p className="text-lg font-bold mt-1">
                      Total ${o.total_all_in !== undefined && o.total_all_in !== null ? o.total_all_in.toFixed(2) : "?"}{" "}
                      {perPerson(o.total_all_in) ? `· ${perPerson(o.total_all_in)}` : ""}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        className="px-3 py-1 rounded border"
                        onClick={() => copyQuote(o)}
                      >
                        Copy Quote
                      </button>
                      <button className="px-3 py-1 rounded border">Hot Lead ★</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
