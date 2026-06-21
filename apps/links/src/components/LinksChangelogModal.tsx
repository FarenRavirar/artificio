import { ChangelogModal } from "@artificio/ui";
import changelogs from "../data/changelogs.json";
import type { ChangelogEntry } from "@artificio/ui";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function LinksChangelogModal({ isOpen, onClose }: Props) {
  return (
    <ChangelogModal
      isOpen={isOpen}
      onClose={onClose}
      changelogs={changelogs as ChangelogEntry[]}
    />
  );
}
