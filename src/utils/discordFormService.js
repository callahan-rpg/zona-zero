/**
 * Utilitário para envio de formulários customizados para o Discord via Webhook.
 */

/**
 * Envia os dados preenchidos de um formulário para um Webhook do Discord.
 * 
 * @param {Object} params
 * @param {string} params.webhookUrl - URL do webhook do Discord
 * @param {Object} params.formConfig - Configuração do formulário (title, description, embedColor, etc.)
 * @param {Object} params.fieldValues - Valores preenchidos pelo usuário { [fieldId]: value }
 * @param {Object} params.userData - Dados do usuário/personagem { uid, name, profession, locationName, avatarUrl }
 * @returns {Promise<boolean>}
 */
export async function sendFormToDiscord({ webhookUrl, formConfig, fieldValues, userData }) {
  if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('https://')) {
    throw new Error('URL do Webhook do Discord inválida ou não informada.')
  }

  // Prepara os fields do Embed do Discord
  const fields = (formConfig.fields || []).map((field) => {
    let rawVal = fieldValues[field.id]
    
    // Formata o valor dependendo do tipo
    let formattedVal = '—'
    if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
      if (Array.isArray(rawVal)) {
        formattedVal = rawVal.join(', ') || 'Nenhum'
      } else if (typeof rawVal === 'boolean') {
        formattedVal = rawVal ? 'Sim' : 'Não'
      } else {
        formattedVal = String(rawVal)
      }
    }

    // Discord exige que o value do field tenha no máximo 1024 caracteres
    if (formattedVal.length > 1020) {
      formattedVal = formattedVal.substring(0, 1020) + '...'
    }

    return {
      name: `${field.label || 'Campo'} ${field.required ? '*' : ''}`,
      value: formattedVal || '—',
      inline: !!field.inline
    }
  })

  // Adiciona informações de autoria / personagem no embed
  const charName = userData?.name || 'Sobrevivente Anônimo'
  const charProfession = userData?.profession ? ` (${userData.profession})` : ''
  const locationInfo = userData?.locationName ? `📍 Local: ${userData.locationName}` : ''

  // Cor decimal do Discord (padrão vermelho sangue ou customizada em hex)
  let colorDecimal = 15548997 // #ed4245
  if (formConfig.embedColor) {
    const cleanHex = formConfig.embedColor.replace('#', '')
    const parsed = parseInt(cleanHex, 16)
    if (!isNaN(parsed)) colorDecimal = parsed
  }

  const embed = {
    title: `${formConfig.icon ? `${formConfig.icon} ` : ''}${formConfig.title || 'Formulário Recebido'}`,
    description: formConfig.description ? formConfig.description.substring(0, 2048) : undefined,
    color: colorDecimal,
    fields: fields,
    author: {
      name: `${charName}${charProfession}`,
      icon_url: userData?.avatarUrl || undefined
    },
    footer: {
      text: `Zona Zero RPG ${locationInfo ? `• ${locationInfo}` : ''} • ID: ${userData?.uid ? userData.uid.substring(0, 8) : 'anon'}`
    },
    timestamp: new Date().toISOString()
  }

  // Se houver imagem configurada no formulário
  if (formConfig.imageUrl && formConfig.imageUrl.startsWith('http')) {
    embed.thumbnail = { url: formConfig.imageUrl }
  }

  const payload = {
    content: formConfig.notifyPing ? formConfig.notifyPing : undefined,
    username: formConfig.botUsername || 'Zona Zero • Central',
    avatar_url: formConfig.botAvatarUrl || 'https://res.cloudinary.com/z3cr8lix/image/upload/v1789136338/iszapvfszdg6phioddwn.png',
    embeds: [embed]
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    console.error('Erro no Webhook Discord:', response.status, errorText)
    throw new Error(`Erro ao enviar para o Discord (${response.status}): ${errorText || 'Verifique o link do Webhook'}`)
  }

  return true
}
