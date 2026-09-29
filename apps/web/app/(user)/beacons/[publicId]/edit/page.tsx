"use client";

import { useParams } from "next/navigation";

import { BeaconEditorWorkspace } from "@/features/profile/beacon-editor-workspace";

export default function EditBeaconPage() {
  const { publicId } = useParams<{ publicId: string }>();
  return <BeaconEditorWorkspace key={publicId} publicId={publicId} />;
}
