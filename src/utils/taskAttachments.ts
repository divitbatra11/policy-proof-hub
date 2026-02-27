import { supabase } from "@/integrations/supabase/client";

export const TASK_ATTACHMENTS_BUCKET = "task-attachments";

const sanitizeFileName = (fileName: string) =>
  fileName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");

export const isExternalAttachmentUrl = (value: string) =>
  /^https?:\/\//i.test(value) || /^mailto:/i.test(value) || /^tel:/i.test(value);

export const normalizeExternalUrl = (rawUrl: string) => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  // Allow common schemes
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return trimmed;
  }

  // Default to https if the user typed something like example.com
  return `https://${trimmed}`;
};

export const uploadTaskAttachment = async ({
  file,
  taskId,
  userId,
}: {
  file: File;
  taskId: string;
  userId: string;
}) => {
  const safeName = sanitizeFileName(file.name);
  const filePath = `${userId}/${taskId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(TASK_ATTACHMENTS_BUCKET)
    .upload(filePath, file, { upsert: false });

  if (error) throw error;

  return {
    filePath,
    fileName: file.name,
  };
};

export const deleteTaskAttachment = async (filePath: string) => {
  // If this "attachment" is an external link, there's nothing to delete.
  if (isExternalAttachmentUrl(filePath)) return;

  const { error } = await supabase.storage
    .from(TASK_ATTACHMENTS_BUCKET)
    .remove([filePath]);

  if (error) throw error;
};

export const getTaskAttachmentSignedUrl = async (filePath: string) => {
  // Maintain backwards compatibility: if this is a link, just return it.
  if (isExternalAttachmentUrl(filePath)) return filePath;

  const { data, error } = await supabase.storage
    .from(TASK_ATTACHMENTS_BUCKET)
    .createSignedUrl(filePath, 60 * 60);

  if (error) throw error;

  return data.signedUrl;
};

export const getTaskAttachmentUrl = async (attachmentPath: string) => {
  return getTaskAttachmentSignedUrl(attachmentPath);
};