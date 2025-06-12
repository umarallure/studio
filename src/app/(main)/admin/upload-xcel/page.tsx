"use client";
import React, { useState } from "react";
import * as XLSX from "xlsx";

const UploadXcelPage = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const leadVendorMap: Record<string, string> = {
    "Rawlpindi Tiger": "Team 1",
    "Lahore qalanders": "Team 2",
    "Islamabad United": "Team 3",
    "Timberwolfs": "Team 4",
    "Rawlpindi Express": "Team 5",
    "Rawlpindi Gladiators": "Team 6",
    "Peshawar Zalmi": "Team 7",
    "Multan Sultans": "Team 8",
    "Avengers": "Team 9",
    "Hustlers": "Team 10",
    "A-Team": "Team 11",
    "Rawlpindi Bears": "Team 12",
    "Alpha's": "Team 13",
    "Vipers": "Team 14",
    "Karachi Kings": "Team 15",
    "Islamabad Sneaks": "Team 16",
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    let json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    // Map Lead Vender values
    json = json.map((row: any) => {
      if (row["Lead Vender"] && leadVendorMap[row["Lead Vender"]]) {
        return { ...row, ["Lead Vender"]: leadVendorMap[row["Lead Vender"]] };
      }
      return row;
    });
    setRows(json);
  };

  const handleUpload = async () => {
    setUploading(true);
    setMessage("");
    try {
      const res = await fetch("/api/upload-xcel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (res.ok) setMessage("Upload successful!");
      else setMessage("Upload failed.");
    } catch (err) {
      setMessage("Error uploading data.");
    }
    setUploading(false);
  };

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Upload Excel Sheet to Firebase</h1>
      <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="mb-4" />
      {rows.length > 0 && (
        <>
          <div className="mb-4">{rows.length} rows ready to upload.</div>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload to Firebase"}
          </button>
        </>
      )}
      {message && <div className="mt-4">{message}</div>}
    </div>
  );
};

export default UploadXcelPage;
