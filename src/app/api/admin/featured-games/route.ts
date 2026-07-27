import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { authorizeAdminRequest } from "@/lib/server/adminAuthorization";
import { deleteAdminImage, uploadAdminImage } from "@/lib/server/adminMedia";

export const runtime = "nodejs";

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function text(value: FormDataEntryValue | null, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
function serialize(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k,v]) => [k, serialize(v)]));
  return value;
}
function isValidHttpUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; }
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, "content_featured_games");
  if (!authorization.ok) return authorization.response;
  const snapshot = await adminDb.collection("featuredGames").orderBy("sortOrder", "asc").get();
  return reply({ ok: true, games: snapshot.docs.map((document) => ({ id: document.id, ...(serialize(document.data()) as Record<string, unknown>) })) });
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, "content_featured_games");
  if (!authorization.ok) return authorization.response;
  let uploadedPath = "";
  try {
    const formData = await request.formData();
    const id = text(formData.get("id"), 128);
    const projectTitle = text(formData.get("projectTitle"), 180);
    const creatorName = text(formData.get("creatorName"), 140);
    const projectDescription = text(formData.get("projectDescription"), 3000);
    const projectLink = text(formData.get("projectLink"), 1000);
    const isPublished = formData.get("isPublished") === "true";
    const imageEntry = formData.get("image");
    const image = imageEntry instanceof File && imageEntry.size > 0 ? imageEntry : null;
    if (!projectTitle || !creatorName || !projectDescription || !projectLink) return reply({ ok:false, error:"Complete all required featured-game fields." },400);
    if (!isValidHttpUrl(projectLink)) return reply({ ok:false, error:"Project Link must be a valid HTTP or HTTPS URL." },400);
    const reference = id ? adminDb.collection("featuredGames").doc(id) : adminDb.collection("featuredGames").doc();
    const previousSnapshot = id ? await reference.get() : null;
    if (id && !previousSnapshot?.exists) return reply({ ok:false, error:"The featured game was not found." },404);
    const previous = previousSnapshot?.data() || {};
    let imageUrl = String(previous.imageUrl || "");
    let imagePath = String(previous.imagePath || "");
    if (!id && !image) return reply({ ok:false, error:"Please upload an image for this featured game." },400);
    if (image) { const uploaded = await uploadAdminImage({ file:image, folder:"featured-games" }); imageUrl=uploaded.imageUrl; imagePath=uploaded.imagePath; uploadedPath=uploaded.imagePath; }
    let sortOrder = Number(previous.sortOrder || 0);
    if (!id) { const latest = await adminDb.collection("featuredGames").orderBy("sortOrder","desc").limit(1).get(); sortOrder = latest.empty ? 1 : Number(latest.docs[0].data().sortOrder || 0)+1; }
    await reference.set({ projectTitle, creatorName, projectDescription, projectLink, imageUrl, imagePath, isPublished, sortOrder, updatedAt:FieldValue.serverTimestamp(), updatedByUid:authorization.staff.uid, updatedByEmail:authorization.staff.emailAddress, ...(id?{}:{ createdAt:FieldValue.serverTimestamp(), createdByUid:authorization.staff.uid, createdByEmail:authorization.staff.emailAddress }) }, { merge:true });
    if (image && previous.imagePath && previous.imagePath !== imagePath) await deleteAdminImage(String(previous.imagePath)).catch(() => undefined);
    uploadedPath = "";
    return reply({ ok:true, id:reference.id });
  } catch (error) {
    if (uploadedPath) await deleteAdminImage(uploadedPath).catch(() => undefined);
    return reply({ ok:false, error:error instanceof Error ? error.message : "Could not save the featured game." },500);
  }
}

export async function PATCH(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, "content_featured_games");
  if (!authorization.ok) return authorization.response;
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const action = typeof body?.action === "string" ? body.action.trim() : "";
  if (!id) return reply({ ok:false, error:"The featured-game ID is missing." },400);
  const reference = adminDb.collection("featuredGames").doc(id);
  const snapshot = await reference.get();
  if (!snapshot.exists) return reply({ ok:false, error:"The featured game was not found." },404);
  if (action === "toggle_published") { await reference.update({ isPublished:snapshot.data()?.isPublished !== true, updatedAt:FieldValue.serverTimestamp(), updatedByUid:authorization.staff.uid, updatedByEmail:authorization.staff.emailAddress }); return reply({ok:true}); }
  if (action === "reorder") {
    const direction = body?.direction === "up" ? "up" : body?.direction === "down" ? "down" : "";
    if (!direction) return reply({ok:false,error:"The reorder direction is invalid."},400);
    const currentOrder = Number(snapshot.data()?.sortOrder || 0);
    const candidates = direction === "up"
      ? await adminDb.collection("featuredGames").where("sortOrder","<",currentOrder).orderBy("sortOrder","desc").limit(1).get()
      : await adminDb.collection("featuredGames").where("sortOrder",">",currentOrder).orderBy("sortOrder","asc").limit(1).get();
    if (candidates.empty) return reply({ok:true});
    const target = candidates.docs[0]; const targetOrder = Number(target.data().sortOrder || 0);
    await adminDb.runTransaction(async (transaction) => { transaction.update(reference,{sortOrder:targetOrder,updatedAt:FieldValue.serverTimestamp(),updatedByUid:authorization.staff.uid}); transaction.update(target.ref,{sortOrder:currentOrder,updatedAt:FieldValue.serverTimestamp(),updatedByUid:authorization.staff.uid}); });
    return reply({ok:true});
  }
  return reply({ok:false,error:"The featured-game action is invalid."},400);
}

export async function DELETE(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, "content_featured_games");
  if (!authorization.ok) return authorization.response;
  const id = new URL(request.url).searchParams.get("id")?.trim() || "";
  if (!id) return reply({ok:false,error:"The featured-game ID is missing."},400);
  const reference = adminDb.collection("featuredGames").doc(id); const snapshot = await reference.get();
  if (!snapshot.exists) return reply({ok:false,error:"The featured game was not found."},404);
  const imagePath = String(snapshot.data()?.imagePath || "");
  await reference.delete();
  await deleteAdminImage(imagePath).catch(() => undefined);
  return reply({ok:true});
}