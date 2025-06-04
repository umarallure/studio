
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, type DocumentData } from 'firebase/firestore';
import type { SheetRow } from '@/lib/types';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle, FileText, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SHEET_DATA_COLLECTION_PATH = "Sheet1Rows";

// Helper to map Firestore document data to SheetRow type
function mapDocToSheetRow(docId: string, data: DocumentData | undefined): SheetRow | null {
  if (!data) return null;
  return {
    id: docId,
    Agent: data.Agent,
    Date: data.Date,
    FromCallback: data['From Callback?'], // Accessing field with space and ?
    INSURED_NAME: data['INSURED NAME'],   // Accessing field with space
    LeadVender: data['Lead Vender'],      // Accessing field with space
    Notes: data.Notes,
    ProductType: data['Product Type'],    // Accessing field with space
    Status: data.Status,
  };
}


export default function SheetDataPage() {
  const [sheetData, setSheetData] = useState<SheetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const dataCollectionRef = collection(db, SHEET_DATA_COLLECTION_PATH);
    // Order by document ID or a specific field like 'Date' if available and desired
    // For now, ordering by document ID (__name__) as a default
    const q = query(dataCollectionRef, orderBy('__name__')); 

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: SheetRow[] = [];
      snapshot.forEach((doc) => {
        const row = mapDocToSheetRow(doc.id, doc.data());
        if (row) {
          data.push(row);
        }
      });
      setSheetData(data);
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching sheet data:", err);
      setError(`Failed to load sheet data. Please check Firestore permissions for '${SHEET_DATA_COLLECTION_PATH}' and ensure the collection exists.`);
      setIsLoading(false);
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-foreground font-headline">Loading Sheet Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h2 className="text-3xl font-headline text-destructive mt-4">Error Loading Data</h2>
        <p className="text-muted-foreground max-w-lg">{error}</p>
      </div>
    );
  }

  if (sheetData.length === 0) {
    return (
       <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <Info className="h-16 w-16 text-primary" />
        <h2 className="text-3xl font-headline text-primary mt-4">No Data Found</h2>
        <p className="text-muted-foreground max-w-lg">
          No entries found in the '{SHEET_DATA_COLLECTION_PATH}' collection in Firestore.
          <br/>Data will appear here in real-time as it's added.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-card rounded-lg shadow">
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary flex items-center">
          <FileText className="mr-3 h-8 w-8" /> Sheet Data Entries
        </h1>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Entries from Google Sheet</CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
            <TableCaption>A list of entries from your Google Sheet, updated in real-time.</TableCaption>
            <TableHeader>
                <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Insured Name</TableHead>
                <TableHead>Lead Vender</TableHead>
                <TableHead>Product Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>From Callback?</TableHead>
                <TableHead className="max-w-[200px] truncate">Notes</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sheetData.map((row) => (
                <TableRow key={row.id}>
                    <TableCell>{row.Agent || 'N/A'}</TableCell>
                    <TableCell>{row.Date || 'N/A'}</TableCell>
                    <TableCell>{row.INSURED_NAME || 'N/A'}</TableCell>
                    <TableCell>{row.LeadVender || 'N/A'}</TableCell>
                    <TableCell>{row.ProductType || 'N/A'}</TableCell>
                    <TableCell>{row.Status || 'N/A'}</TableCell>
                    <TableCell>{row.FromCallback === undefined ? 'N/A' : row.FromCallback ? 'Yes' : 'No'}</TableCell>
                    <TableCell className="max-w-[200px] truncate hover:whitespace-normal hover:overflow-visible" title={row.Notes}>{row.Notes || 'N/A'}</TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
