// Sem HTTPS ou sem permissão o navegador recusa: quem chama seleciona o texto para a pessoa copiar.
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
