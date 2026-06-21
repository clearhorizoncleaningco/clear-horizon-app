import { uploadJobPhotoAction } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

/**
 * Before/after photo uploader (BUILD_SPEC §G Phase 3). A multipart server-action
 * form — works for the assigned cleaner and for Admin/Office. The action streams
 * the file to Supabase Storage and records a JobPhoto row.
 */
export function PhotoUploader({ jobId }: { jobId: string }) {
  return (
    <form action={uploadJobPhotoAction} className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <input type="hidden" name="jobId" value={jobId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`kind-${jobId}`}>Tag</Label>
          <Select id={`kind-${jobId}`} name="kind" defaultValue="After">
            <option value="Before">Before</option>
            <option value="After">After</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`photo-${jobId}`}>Photo</Label>
          <Input
            id={`photo-${jobId}`}
            type="file"
            name="photo"
            accept="image/png,image/jpeg,image/webp,image/heic"
            required
            className="file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-secondary-foreground"
          />
        </div>
        <Input name="room" placeholder="Room (optional)" />
        <Input name="caption" placeholder="Caption (optional)" />
      </div>
      <div>
        <Button type="submit" size="sm">Upload photo</Button>
      </div>
    </form>
  );
}
