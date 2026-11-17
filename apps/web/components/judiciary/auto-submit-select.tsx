'use client';
import * as React from 'react';
import { NativeSelect } from '@/components/ui/native-select';

/** P14.45 (ajuste visual) — mesmo `<select>` nativo (acessível, sem reinventar teclado/ARIA), só
 * navegando ao trocar de valor em vez de exigir um botão "Aplicar" separado, pra casar com o mock do
 * usuário (nenhum dos filtros do Explorador mostra um botão de envio visível). O `<form>` continua
 * sendo um GET comum — só troca quem dispara o envio. */
export function AutoSubmitSelect(props: React.ComponentProps<typeof NativeSelect>) {
  return (
    <NativeSelect
      {...props}
      onChange={e => {
        props.onChange?.(e);
        e.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
