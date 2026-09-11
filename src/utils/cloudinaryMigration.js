import { getDocs, collection, doc, updateDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { uploadBase64ToCloudinary } from './imageUpload'
import { saveConsolidatedCatalog } from './itemCatalogService'

/**
 * Utilitário completo para varrer o Firestore e migrar imagens Base64 residuais para o Cloudinary.
 * 
 * Coleções verificadas:
 * 1. items_db (Catálogo de itens legados e ativos) + game_config/items_catalog
 * 2. locations (Salas, cenários, clima, backgrounds)
 * 3. monsters (Inimigos do combate)
 * 4. game_config/home (Slides da tela inicial)
 * 5. pre_made_sheets (Fichas pré-prontas)
 * 6. users (Avatares dos personagens dos jogadores)
 * 
 * @param {Function} onProgress Callback de status/progresso (ex: (msg) => console.log(msg))
 * @returns {Promise<{ totalMigrated: number, errors: string[] }>}
 */
export async function migrateAllBase64ToCloudinary(onProgress = () => {}) {
  let totalMigrated = 0
  const errors = []

  const isBase64 = (str) => typeof str === 'string' && str.startsWith('data:image')

  // -------------------------------------------------------------
  // 1. MIGRAÇÃO DE ITENS (items_db e items_catalog)
  // -------------------------------------------------------------
  onProgress('📦 Verificando itens do catálogo...')
  try {
    const itemsSnap = await getDocs(collection(db, 'items_db'))
    const allItems = []

    for (const d of itemsSnap.docs) {
      const data = d.data()
      let modified = false
      let currentImageUrl = data.imageUrl

      if (isBase64(currentImageUrl)) {
        try {
          onProgress(`Subindo imagem do item: ${data.name || d.id}...`)
          const newUrl = await uploadBase64ToCloudinary(currentImageUrl)
          currentImageUrl = newUrl
          await updateDoc(doc(db, 'items_db', d.id), { imageUrl: newUrl })
          totalMigrated++
          modified = true
          // Pequena pausa para evitar flood de requisições simultâneas
          await new Promise(r => setTimeout(r, 600))
        } catch (err) {
          errors.push(`Item ${data.name || d.id}: ${err.message}`)
        }
      }

      allItems.push({
        ...data,
        id: d.id,
        itemId: data.itemId || d.id,
        imageUrl: currentImageUrl
      })
    }

    // Atualiza também o catálogo consolidado
    if (allItems.length > 0) {
      await saveConsolidatedCatalog(allItems)
    }
  } catch (err) {
    errors.push(`Falha ao ler items_db: ${err.message}`)
  }

  // -------------------------------------------------------------
  // 2. MIGRAÇÃO DE LOCAIS (locations)
  // -------------------------------------------------------------
  onProgress('🗺️ Verificando locais e cenários...')
  try {
    const locsSnap = await getDocs(collection(db, 'locations'))
    for (const d of locsSnap.docs) {
      const loc = d.data()
      const updates = {}

      const bgKeys = ['backgroundImage', 'backgroundImageDay', 'backgroundImageNight', 'backgroundImageTwilight']
      for (const k of bgKeys) {
        if (isBase64(loc[k])) {
          try {
            onProgress(`Subindo imagem (${k}) do local: ${loc.name || d.id}...`)
            const newUrl = await uploadBase64ToCloudinary(loc[k])
            updates[k] = newUrl
            totalMigrated++
          } catch (err) {
            errors.push(`Local ${loc.name || d.id} (${k}): ${err.message}`)
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'locations', d.id), updates)
      }
    }
  } catch (err) {
    errors.push(`Falha ao ler locations: ${err.message}`)
  }

  // -------------------------------------------------------------
  // 3. MIGRAÇÃO DE INIMIGOS (monsters)
  // -------------------------------------------------------------
  onProgress('🧟 Verificando monstros e zumbis...')
  try {
    const monstersSnap = await getDocs(collection(db, 'monsters'))
    for (const d of monstersSnap.docs) {
      const m = d.data()
      if (isBase64(m.avatarUrl)) {
        try {
          onProgress(`Subindo imagem do monstro: ${m.name || d.id}...`)
          const newUrl = await uploadBase64ToCloudinary(m.avatarUrl)
          await updateDoc(doc(db, 'monsters', d.id), { avatarUrl: newUrl })
          totalMigrated++
        } catch (err) {
          errors.push(`Monstro ${m.name || d.id}: ${err.message}`)
        }
      }
    }
  } catch (err) {
    errors.push(`Falha ao ler monsters: ${err.message}`)
  }

  // -------------------------------------------------------------
  // 4. MIGRAÇÃO DE FICHAS PRÉ-PRONTAS (pre_made_sheets)
  // -------------------------------------------------------------
  onProgress('👤 Verificando fichas pré-prontas...')
  try {
    const sheetsSnap = await getDocs(collection(db, 'pre_made_sheets'))
    for (const d of sheetsSnap.docs) {
      const s = d.data()
      if (isBase64(s.avatarUrl)) {
        try {
          onProgress(`Subindo imagem da ficha pré-pronta: ${s.title || d.id}...`)
          const newUrl = await uploadBase64ToCloudinary(s.avatarUrl)
          await updateDoc(doc(db, 'pre_made_sheets', d.id), { avatarUrl: newUrl })
          totalMigrated++
        } catch (err) {
          errors.push(`Ficha pré-pronta ${s.title || d.id}: ${err.message}`)
        }
      }
    }
  } catch (err) {
    errors.push(`Falha ao ler pre_made_sheets: ${err.message}`)
  }

  // -------------------------------------------------------------
  // 5. MIGRAÇÃO DE SLIDES DA HOME (game_config/home)
  // -------------------------------------------------------------
  onProgress('🏠 Verificando slides da tela inicial...')
  try {
    const homeDocSnap = await getDocs(collection(db, 'game_config'))
    const homeDoc = homeDocSnap.docs.find(d => d.id === 'home')
    if (homeDoc && homeDoc.exists()) {
      const data = homeDoc.data()
      let modified = false
      const slides = [...(data.slides || [])]

      for (let i = 0; i < slides.length; i++) {
        if (isBase64(slides[i].imageUrl)) {
          try {
            onProgress(`Subindo imagem do slide ${i + 1}...`)
            const newUrl = await uploadBase64ToCloudinary(slides[i].imageUrl)
            slides[i].imageUrl = newUrl
            totalMigrated++
            modified = true
          } catch (err) {
            errors.push(`Slide ${i + 1}: ${err.message}`)
          }
        }
      }

      if (modified) {
        await updateDoc(doc(db, 'game_config', 'home'), { slides })
      }
    }
  } catch (err) {
    errors.push(`Falha ao verificar slides: ${err.message}`)
  }

  // -------------------------------------------------------------
  // 6. MIGRAÇÃO DE PERSONAGENS / AVATARES DOS JOGADORES (users)
  // -------------------------------------------------------------
  onProgress('👥 Verificando avatares de jogadores...')
  try {
    const usersSnap = await getDocs(collection(db, 'users'))
    for (const d of usersSnap.docs) {
      const u = d.data()
      if (u.character && isBase64(u.character.avatarUrl)) {
        try {
          onProgress(`Subindo avatar de ${u.character.name || d.id}...`)
          const newUrl = await uploadBase64ToCloudinary(u.character.avatarUrl)
          await updateDoc(doc(db, 'users', d.id), { 'character.avatarUrl': newUrl })
          totalMigrated++
        } catch (err) {
          errors.push(`Jogador ${u.character.name || d.id}: ${err.message}`)
        }
      }
    }
  } catch (err) {
    errors.push(`Falha ao verificar users: ${err.message}`)
  }

  onProgress(`Concluído! Total de imagens migradas para o Cloudinary: ${totalMigrated}`)
  return { totalMigrated, errors }
}
