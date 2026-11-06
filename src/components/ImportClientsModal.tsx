"use client";

import React, { useState } from "react";
import { Upload, X, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { FIELD_LABELS, ImportRow, rowsFromSheet } from "@/lib/client-import";

interface Props {
  onClose: () => void;
  onImported: (created: number) => void;
}

type Parsed = ReturnType<typeof rowsFromSheet> & { fileName: string };

async function readFile(file: File): Promise<unknown[][]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as unknown[][];
  }
  if (lower.endsWith(".xls")) {
    throw new Error("Aquest Excel és d'un format antic (.xls). Obre'l i desa'l com a .xlsx o .csv.");
  }
  // CSV o TXT: Papa detecta sol si el separador és coma, punt i coma o tabulador
  const Papa = (await import("papaparse")).default;
  let text = await file.text();
  // Fitxers desats amb Excel en Windows solen venir en Latin-1
  if (text.includes("�")) text = new TextDecoder("windows-1252").decode(await file.arrayBuffer());
  const res = Papa.parse<string[]>(text, { skipEmptyLines: true });
  return res.data;
}

export function ImportClientsModal({ onClose, onImported }: Props) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; duplicates: number; invalid: number } | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setParsed(null);
    setBusy(true);
    try {
      const data = await readFile(file);
      const out = rowsFromSheet(data);
      if (out.rows.length === 0) throw new Error("No he trobat cap clienta al fitxer. Comprova que tingui una columna de nom.");
      setParsed({ ...out, fileName: file.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No s'ha pogut llegir el fitxer");
    }
    setBusy(false);
  };

  const doImport = async () => {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/clients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsed.rows }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setResult(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error en importar");
    }
    setBusy(false);
  };

  const withoutPhone = parsed?.rows.filter((r: ImportRow) => !r.phone).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h3 className="font-bold text-stone-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-terra-600" /> Importar llistat de clientes
          </h3>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {result ? (
            <div className="space-y-3 text-sm text-stone-700">
              <p className="text-base font-bold text-stone-900">{result.created} clientes importades</p>
              {result.duplicates > 0 && <p>{result.duplicates} ja hi eren (mateix telèfon o nom) i no s&apos;han duplicat.</p>}
              {result.invalid > 0 && <p>{result.invalid} files sense nom s&apos;han saltat.</p>}
              <button
                onClick={() => onImported(result.created)}
                className="w-full py-2.5 text-sm font-bold text-white bg-terra-600 hover:bg-terra-700 rounded-xl"
              >
                Fet
              </button>
            </div>
          ) : (
            <>
              <label className="block border-2 border-dashed border-terra-200 hover:border-terra-400 rounded-2xl p-6 text-center cursor-pointer bg-terra-50/40">
                <Upload className="w-6 h-6 text-terra-500 mx-auto mb-2" />
                <span className="text-sm font-bold text-stone-800">
                  {parsed ? parsed.fileName : "Tria el fitxer Excel (.xlsx) o CSV"}
                </span>
                <span className="block text-xs text-stone-500 mt-1">
                  Ha de tenir una fila de títols, per exemple: Nom, Cognoms, Telèfon, Email, Aniversari, Notes
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  className="hidden"
                  onChange={e => onFile(e.target.files?.[0])}
                />
              </label>

              {busy && !parsed && <p className="text-xs text-stone-500">Llegint el fitxer...</p>}

              {parsed && (
                <>
                  <div className="text-xs text-stone-600 space-y-1">
                    <p>
                      <b className="text-stone-900">{parsed.rows.length} clientes</b> trobades.
                      {withoutPhone > 0 && <> {withoutPhone} no tenen telèfon (s&apos;importen igualment).</>}
                      {parsed.skipped > 0 && <> {parsed.skipped} files sense nom es saltaran.</>}
                    </p>
                    <p>
                      Columnes reconegudes:{" "}
                      {Object.keys(parsed.columns).map(k => FIELD_LABELS[k as keyof typeof FIELD_LABELS]).join(", ")}
                    </p>
                  </div>

                  <div className="border border-stone-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-stone-50 text-stone-500">
                        <tr>
                          <th className="text-left px-3 py-2">Nom</th>
                          <th className="text-left px-3 py-2">Telèfon</th>
                          <th className="text-left px-3 py-2">Email</th>
                          <th className="text-left px-3 py-2">Aniversari</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.rows.slice(0, 6).map((r, i) => (
                          <tr key={i} className="border-t border-stone-100">
                            <td className="px-3 py-1.5 font-semibold text-stone-800">{r.name}</td>
                            <td className="px-3 py-1.5">{r.phone || <span className="text-stone-300">—</span>}</td>
                            <td className="px-3 py-1.5">{r.email || <span className="text-stone-300">—</span>}</td>
                            <td className="px-3 py-1.5">{r.birthday || <span className="text-stone-300">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsed.rows.length > 6 && (
                      <p className="px-3 py-1.5 text-[11px] text-stone-400 border-t border-stone-100">
                        i {parsed.rows.length - 6} més...
                      </p>
                    )}
                  </div>

                  <p className="text-[11px] text-stone-500">
                    Les clientes que ja tens (mateix telèfon) no es duplicaran, així que el pots tornar a importar sense por.
                  </p>

                  <button
                    onClick={doImport}
                    disabled={busy}
                    className="w-full py-2.5 text-sm font-bold text-white bg-gradient-to-r from-terra-600 to-arcilla-600 rounded-xl disabled:opacity-50"
                  >
                    {busy ? "Important..." : `Importar ${parsed.rows.length} clientes`}
                  </button>
                </>
              )}

              {error && (
                <p className="text-xs font-semibold text-red-600 flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
