import type { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs";
import { promises as fsp } from "fs";
import { pipeline } from "stream/promises";
import crypto from "crypto";
import { authenticate } from "../middleware/authenticate";

// Allowed MIME types with file extensions and per-type size ceilings (WhatsApp limits)
const ALLOWED_TYPES = {
  "image/jpeg":      { ext: ".jpg",  maxBytes: 5   * 1024 * 1024, label: "5 MB"   },
  "image/png":       { ext: ".png",  maxBytes: 5   * 1024 * 1024, label: "5 MB"   },
  "image/webp":      { ext: ".webp", maxBytes: 5   * 1024 * 1024, label: "5 MB"   },
  "image/gif":       { ext: ".gif",  maxBytes: 5   * 1024 * 1024, label: "5 MB"   },
  "video/mp4":       { ext: ".mp4",  maxBytes: 16  * 1024 * 1024, label: "16 MB"  },
  "video/3gpp":      { ext: ".3gp",  maxBytes: 16  * 1024 * 1024, label: "16 MB"  },
  "application/pdf": { ext: ".pdf",  maxBytes: 100 * 1024 * 1024, label: "100 MB" },
  "application/msword":
    { ext: ".doc",  maxBytes: 100 * 1024 * 1024, label: "100 MB" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    { ext: ".docx", maxBytes: 100 * 1024 * 1024, label: "100 MB" },
  "application/vnd.ms-excel":
    { ext: ".xls",  maxBytes: 100 * 1024 * 1024, label: "100 MB" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    { ext: ".xlsx", maxBytes: 100 * 1024 * 1024, label: "100 MB" },
  "application/vnd.ms-powerpoint":
    { ext: ".ppt",  maxBytes: 100 * 1024 * 1024, label: "100 MB" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    { ext: ".pptx", maxBytes: 100 * 1024 * 1024, label: "100 MB" },
} as const;

type AllowedMimeType = keyof typeof ALLOWED_TYPES;

export function getUploadDir(): string {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), "uploads");
}

export function buildPublicUrl(filename: string): string {
  const raw = (
    process.env.MEDIA_PUBLIC_URL ??
    process.env.BACKEND_PUBLIC_URL ??
    process.env.FRONTEND_URL ??
    `http://localhost:${process.env.PORT ?? 4000}`
  ).replace(/\/$/, "");
  // Strip trailing /api so the file URL uses the clean /uploads/[filename] route
  // served by the frontend — a URL WhatsApp/MSG91 servers can publicly fetch.
  const base = raw.replace(/\/api$/, "");
  return `${base}/uploads/${filename}`;
}

export async function ensureUploadDir(): Promise<void> {
  await fsp.mkdir(getUploadDir(), { recursive: true });
}

export async function uploadRoutes(app: FastifyInstance) {
  // Create upload directory on startup (idempotent)
  await ensureUploadDir();

  /**
   * POST /uploads/template-media
   * Accepts a single file via multipart/form-data (field name: "file").
   * Returns the public URL to use as a template header media sample.
   */
  app.post("/template-media", { preHandler: [authenticate] }, async (request, reply) => {
    let dest: string | undefined;
    try {
      // 100 MB ceiling — per-type limits enforced after we know the MIME type
      const file = await request.file({ limits: { fileSize: 100 * 1024 * 1024, files: 1 } });

      if (!file) {
        return reply.status(400).send({
          error: "No file provided. Send a multipart/form-data request with a 'file' field.",
        });
      }

      const mimeType = file.mimetype as AllowedMimeType;
      const allowed = ALLOWED_TYPES[mimeType];

      if (!allowed) {
        // Drain the stream to avoid leaving a hanging pipe
        file.file.resume();
        await new Promise<void>((resolve) => file.file.once("end", resolve));
        return reply.status(400).send({
          error: `Unsupported file type "${file.mimetype}". Allowed: JPEG, PNG, WEBP, GIF, MP4, 3GP, PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX`,
        });
      }

      const filename = `${crypto.randomUUID()}${allowed.ext}`;
      dest = path.join(getUploadDir(), filename);

      await pipeline(file.file, fs.createWriteStream(dest));

      // @fastify/multipart sets .truncated = true when fileSize limit is hit
      if ((file.file as unknown as { truncated?: boolean }).truncated) {
        await fsp.unlink(dest).catch(() => {});
        return reply.status(400).send({ error: "File exceeds the 100 MB upload ceiling." });
      }

      const { size } = await fsp.stat(dest);

      if (size > allowed.maxBytes) {
        await fsp.unlink(dest).catch(() => {});
        return reply.status(400).send({
          error: `${mimeType} files must be under ${allowed.label}. Your file is ${(size / 1024 / 1024).toFixed(1)} MB.`,
        });
      }

      return reply.status(201).send({
        url:          buildPublicUrl(filename),
        filename,
        size,
        mimeType,
        originalName: file.filename,
      });
    } catch (err: unknown) {
      if (dest) await fsp.unlink(dest).catch(() => {});
      app.log.error({ err }, "[uploads] file upload failed");
      return reply.status(500).send({ error: "File upload failed. Please try again." });
    }
  });
}
