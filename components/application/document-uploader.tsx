"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, Camera, X, FileText, CheckCircle2, Loader2, ZoomIn } from "lucide-react"
import { cn } from "@/lib/utils"

interface UploadedDocument {
  id: string
  name: string
  type: string
  size: number
  status: "uploading" | "processing" | "extracted" | "error"
  preview?: string
  extractedData?: Record<string, { value: string; confidence: number }>
}

interface DocumentUploaderProps {
  title: string
  description: string
  accept?: string
  onDocumentUpload?: (doc: UploadedDocument) => void
}

export function DocumentUploader({
  title,
  description,
  accept = "image/*,application/pdf",
  onDocumentUpload,
}: DocumentUploaderProps) {
  const [document, setDocument] = useState<UploadedDocument | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => {
    const newDoc: UploadedDocument = {
      id: Date.now().toString(),
      name: file.name,
      type: file.type,
      size: file.size,
      status: "uploading",
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }

    setDocument(newDoc)

    // Simulate upload progress
    setTimeout(() => {
      setDocument((prev) => prev ? { ...prev, status: "processing" } : null)
      
      // Simulate AI extraction
      setTimeout(() => {
        const extractedDoc: UploadedDocument = {
          ...newDoc,
          status: "extracted",
          extractedData: {
            "Document Type": { value: "Driver's License", confidence: 98 },
            "Full Name": { value: "John Doe", confidence: 95 },
            "Date of Birth": { value: "01/15/1985", confidence: 92 },
            "Address": { value: "123 Main St, Boston, MA", confidence: 88 },
          },
        }
        setDocument(extractedDoc)
        onDocumentUpload?.(extractedDoc)
      }, 2000)
    }, 1500)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleRemove = () => {
    setDocument(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileSelect(file)
        }}
      />

      {!document ? (
        <div
          className={cn(
            "rounded-lg border-2 border-dashed p-8 text-center transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
          <h4 className="mt-3 font-medium text-foreground">{title}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Browse Files
            </Button>
            <Button variant="ghost" size="sm" className="gap-2">
              <Camera className="h-4 w-4" />
              Use Camera
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Drag and drop or click to upload. PDF, JPG, PNG (max 10MB)
          </p>
        </div>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              {/* Preview */}
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
                {document.preview ? (
                  <>
                    <Image
                      src={document.preview}
                      alt={document.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    <button className="absolute inset-0 flex items-center justify-center bg-foreground/50 opacity-0 transition-opacity hover:opacity-100">
                      <ZoomIn className="h-6 w-6 text-background" />
                    </button>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{document.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(document.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={handleRemove}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Status */}
                <div className="mt-2">
                  {document.status === "uploading" && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </div>
                  )}
                  {document.status === "processing" && (
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      AI extracting data...
                    </div>
                  )}
                  {document.status === "extracted" && (
                    <div className="flex items-center gap-2 text-sm text-success">
                      <CheckCircle2 className="h-4 w-4" />
                      Data extracted successfully
                    </div>
                  )}
                  {document.status === "error" && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <X className="h-4 w-4" />
                      Error processing document
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Extracted Data Preview */}
            {document.status === "extracted" && document.extractedData && (
              <div className="mt-4 rounded-lg border border-border bg-secondary/30">
                <div className="border-b border-border p-3">
                  <p className="text-sm font-medium text-foreground">Extracted Data</p>
                </div>
                <div className="divide-y divide-border">
                  {Object.entries(document.extractedData).map(([key, { value, confidence }]) => (
                    <div key={key} className="flex items-center justify-between p-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{key}</p>
                        <p className="truncate text-sm font-medium text-foreground">{value}</p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                          confidence >= 90
                            ? "bg-success/10 text-success"
                            : confidence >= 75
                            ? "bg-warning/10 text-warning"
                            : "bg-destructive/10 text-destructive"
                        )}
                      >
                        {confidence}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
