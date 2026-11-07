import AdminOpening from "./AdminOpening";

// Every coach admin screen (7 Nov): the opening plays over the first one a page load draws; this layout stays mounted
// from screen to screen, so moving around the admin never plays it again.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AdminOpening />
    </>
  );
}
