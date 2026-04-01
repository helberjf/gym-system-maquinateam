import { permanentRedirect } from "next/navigation";

export default function StoreRedirectPage() {
  permanentRedirect("/products");
}
