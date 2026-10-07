import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
export async function removeTestDirectory(directory: string) {
  const target = path.resolve(directory);
  if (
    path.dirname(target) !== path.resolve(tmpdir()) ||
    !path.basename(target).startsWith("sepet-")
  ) {
    throw new Error(
      "Refusing to remove a directory outside the SepetAI temporary test area.",
    );
  }
  await rm(target, { recursive: true, force: true });
}
