import { ChangelogModal, normalizeChangelogEntries } from "@artificio/ui";
import rawChangelogs from "../data/changelogs.json";

interface Props {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

const changelogs = normalizeChangelogEntries(rawChangelogs);

export function LinksChangelogModal({ isOpen, onClose }: Props) {
  return (
    <ChangelogModal
      isOpen={isOpen}
      onClose={onClose}
      changelogs={changelogs}
    />
  );
}
