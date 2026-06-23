export interface MultipartFilePart {
  fieldName: string;
  fileName: string;
  mimeType: string;
  data: Buffer;
}

export interface ParsedMultipart {
  fields: Map<string, string>;
  files: Map<string, MultipartFilePart>;
}

function extractBoundary(contentType: string): string | null {
  const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  if (!match) {
    return null;
  }
  return match[1] ?? match[2] ?? null;
}

function parseContentDisposition(header: string): { name?: string; filename?: string } {
  const result: { name?: string; filename?: string } = {};
  const nameMatch = /name="([^"]+)"/i.exec(header);
  if (nameMatch) {
    result.name = nameMatch[1];
  }
  const fileMatch = /filename="([^"]+)"/i.exec(header);
  if (fileMatch) {
    result.filename = fileMatch[1];
  }
  return result;
}

/** Minimal multipart/form-data parser for single-file uploads. */
export function parseMultipartFormData(body: Buffer, contentType: string): ParsedMultipart {
  const boundary = extractBoundary(contentType);
  if (!boundary) {
    throw new Error('missing multipart boundary');
  }

  const delimiter = `--${boundary}`;
  const text = body.toString('latin1');
  const parts = text.split(delimiter).slice(1, -1);
  const fields = new Map<string, string>();
  const files = new Map<string, MultipartFilePart>();

  for (const rawPart of parts) {
    const part = rawPart.replace(/^\r\n/, '').replace(/\r\n$/, '');
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      continue;
    }

    const headerBlock = part.slice(0, headerEnd);
    const bodyStart = headerEnd + 4;
    const bodyEnd = part.length - (part.endsWith('\r\n') ? 2 : 0);
    const partBodyLatin1 = part.slice(bodyStart, bodyEnd);
    const partBody = Buffer.from(partBodyLatin1, 'latin1');

    const disposition = headerBlock
      .split('\r\n')
      .find((line) => line.toLowerCase().startsWith('content-disposition:'));
    if (!disposition) {
      continue;
    }

    const { name, filename } = parseContentDisposition(disposition);
    if (!name) {
      continue;
    }

    if (filename) {
      const mimeLine = headerBlock
        .split('\r\n')
        .find((line) => line.toLowerCase().startsWith('content-type:'));
      const mimeType = mimeLine ? mimeLine.split(':')[1]?.trim() ?? 'application/octet-stream' : 'application/octet-stream';
      files.set(name, { fieldName: name, fileName: filename, mimeType, data: partBody });
    } else {
      fields.set(name, partBody.toString('utf8'));
    }
  }

  return { fields, files };
}
