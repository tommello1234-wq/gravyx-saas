
# Plano: Modal de Pré-Lançamento

## Objetivo

Substituir temporariamente o conteúdo do modal de compra de créditos por uma mensagem de pré-lançamento, incentivando os usuários a entrarem no grupo do WhatsApp para acompanhar e ganhar mais créditos.

---

## Design do Modal

O modal atual com os 3 planos de preços será substituído por um layout mais simples e focado:

```text
╭─────────────────────────────────────╮
│  🚀 Lançamento em breve!            │
├─────────────────────────────────────┤
│                                     │
│        📅 14/02/2025                │
│                                     │
│   Lançamento oficial no dia 14/02   │
│                                     │
│   Entre no grupo do WhatsApp para   │
│   acompanhar as novidades e ganhar  │
│   mais créditos grátis pra testar!  │
│                                     │
│   ┌─────────────────────────────┐   │
│   │  Entrar no Grupo WhatsApp   │   │
│   └─────────────────────────────┘   │
│                                     │
│   Por enquanto, você pode testar    │
│   com seus 5 créditos gratuitos.    │
│                                     │
╰─────────────────────────────────────╯
```

---

## Mudanças Técnicas

### Arquivo: `src/components/BuyCreditsModal.tsx`

1. **Remover imports não utilizados**: `Check`, `Zap`, `Crown`, `Coins` e a interface `CreditPackage`

2. **Remover array `packages`**: Todo o bloco com os planos de preços (linhas 25-72)

3. **Remover função `handleBuy`**: Não será mais necessária

4. **Adicionar imports**: 
   - `Rocket` e `Calendar` do lucide-react para os ícones
   - Ícone do WhatsApp (pode ser MessageCircle ou um SVG customizado)

5. **Substituir conteúdo do modal**:

```tsx
export function BuyCreditsModal({ open, onOpenChange }: BuyCreditsModalProps) {
  const whatsappLink = "https://chat.whatsapp.com/HlrgOxOWRPlLjr0wFXCoff";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Rocket className="h-5 w-5 text-primary" />
            Lançamento em breve!
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6"
          >
            {/* Data de lançamento */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
              <Calendar className="h-4 w-4" />
              <span className="font-semibold">14/02/2025</span>
            </div>

            {/* Mensagem principal */}
            <p className="text-lg text-foreground mb-2">
              Lançamento oficial no dia 14/02
            </p>
            <p className="text-muted-foreground mb-6">
              Entre no grupo do WhatsApp para acompanhar as novidades 
              e ganhar mais créditos grátis pra testar!
            </p>

            {/* Botão WhatsApp */}
            <Button
              onClick={() => window.open(whatsappLink, '_blank')}
              className="w-full h-12 rounded-xl font-semibold text-white mb-4"
              style={{ background: '#25D366' }}
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              Entrar no Grupo WhatsApp
            </Button>
          </motion.div>

          <p className="text-sm text-muted-foreground">
            Por enquanto, você pode testar com seus 5 créditos gratuitos.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Resultado

- Modal menor e mais focado (`max-w-md` ao invés de `max-w-4xl`)
- Mensagem clara sobre o lançamento no dia 14/02
- Botão verde do WhatsApp que abre o link do grupo
- Nota informando que podem testar com os 5 créditos gratuitos
- O código dos planos de preços será comentado/removido (pode ser facilmente restaurado depois do lançamento)

---

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/BuyCreditsModal.tsx` | Substituir grid de preços por mensagem de pré-lançamento com link do WhatsApp |
