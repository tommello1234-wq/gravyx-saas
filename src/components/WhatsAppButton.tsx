import { MessageCircle } from "lucide-react";

const WHATSAPP_LINK = "https://api.whatsapp.com/send?phone=5588992089323&text=";

export function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-full text-black font-semibold shadow-lg hover:scale-105 transition-transform"
      style={{ background: "#25D366" }}
    >
      <MessageCircle className="h-5 w-5" />
      <span className="text-sm">Precisa de ajuda?</span>
    </a>
  );
}
