/**
 * conversation-manager.js - Módulo para gestionar conversaciones en la interfaz de usuario
 */

// Importar módulos
const { ipcRenderer } = require('electron');

// Variables globales
let activeConversations = [];
let selectedConversation = null;
let refreshInterval;

/**
 * Inicializa el gestor de conversaciones
 */
function initializeConversationManager() {
  // Configurar eventos
  document.getElementById('refresh-conversations-button')?.addEventListener('click', refreshConversations);
  document.getElementById('filter-conversations')?.addEventListener('input', filterConversations);
  document.getElementById('conversation-status-filter')?.addEventListener('change', refreshConversations);
  document.getElementById('take-over-button')?.addEventListener('click', takeOverConversation);
  document.getElementById('mark-resolved-button')?.addEventListener('click', markConversationResolved);
  document.getElementById('send-message-button')?.addEventListener('click', sendMessage);
  document.getElementById('message-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Cargar conversaciones iniciales
  refreshConversations();
  
  // Configurar actualización automática
  refreshInterval = setInterval(refreshConversations, 30000); // Actualizar cada 30 segundos
}

/**
 * Actualiza la lista de conversaciones
 */
async function refreshConversations() {
  try {
    // Obtener filtro de estado
    const statusFilter = document.getElementById('conversation-status-filter')?.value || 'all';
    
    // Solicitar conversaciones al proceso principal
    activeConversations = await ipcRenderer.invoke('get-conversations', { statusFilter });
    
    // Actualizar lista de conversaciones
    renderConversationList();
    
    // Si hay una conversación seleccionada, actualizarla
    if (selectedConversation) {
      const updatedConversation = activeConversations.find(conv => conv.chatId === selectedConversation.chatId);
      if (updatedConversation) {
        selectConversation(updatedConversation.chatId);
      }
    }
    
    // Mostrar última actualización
    document.getElementById('last-refresh-time').textContent = new Date().toLocaleTimeString();
  } catch (error) {
    console.error('Error al actualizar conversaciones:', error);
    showError('No se pudieron cargar las conversaciones. Inténtalo de nuevo más tarde.');
  }
}

/**
 * Filtra las conversaciones según el texto de búsqueda
 */
function filterConversations() {
  const filterText = document.getElementById('filter-conversations')?.value.toLowerCase() || '';
  const conversationItems = document.querySelectorAll('.conversation-item');
  
  conversationItems.forEach(item => {
    const name = item.querySelector('.conversation-name')?.textContent.toLowerCase() || '';
    const phone = item.querySelector('.conversation-phone')?.textContent.toLowerCase() || '';
    const lastMessage = item.querySelector('.conversation-last-message')?.textContent.toLowerCase() || '';
    
    if (name.includes(filterText) || phone.includes(filterText) || lastMessage.includes(filterText)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

/**
 * Renderiza la lista de conversaciones
 */
function renderConversationList() {
  const conversationsList = document.getElementById('conversations-list');
  if (!conversationsList) return;
  
  // Limpiar lista
  conversationsList.innerHTML = '';
  
  // Verificar si hay conversaciones
  if (activeConversations.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = 'No hay conversaciones activas';
    conversationsList.appendChild(emptyMessage);
    return;
  }
  
  // Ordenar conversaciones por fecha (más recientes primero)
  const sortedConversations = [...activeConversations].sort((a, b) => {
    return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
  });
  
  // Crear elementos para cada conversación
  sortedConversations.forEach(conversation => {
    const conversationItem = document.createElement('div');
    conversationItem.className = 'conversation-item';
    conversationItem.dataset.chatId = conversation.chatId;
    
    // Añadir clase si es la conversación seleccionada
    if (selectedConversation && conversation.chatId === selectedConversation.chatId) {
      conversationItem.classList.add('selected');
    }
    
    // Añadir clase según el estado
    if (conversation.needsHumanAssistance) {
      conversationItem.classList.add('needs-assistance');
    } else if (conversation.status === 'resolved') {
      conversationItem.classList.add('resolved');
    }
    
    // Crear contenido
    conversationItem.innerHTML = `
      <div class="conversation-avatar">
        ${conversation.name.charAt(0).toUpperCase()}
      </div>
      <div class="conversation-info">
        <div class="conversation-header">
          <span class="conversation-name">${conversation.name}</span>
          <span class="conversation-time">${formatTime(conversation.lastMessageTime)}</span>
        </div>
        <div class="conversation-phone">${conversation.phone}</div>
        <div class="conversation-last-message">${conversation.lastMessage}</div>
      </div>
      ${conversation.unreadCount > 0 ? `<div class="unread-badge">${conversation.unreadCount}</div>` : ''}
    `;
    
    // Añadir evento de clic
    conversationItem.addEventListener('click', () => {
      selectConversation(conversation.chatId);
    });
    
    // Añadir a la lista
    conversationsList.appendChild(conversationItem);
  });
}

/**
 * Selecciona una conversación para mostrar sus mensajes
 * @param {string} chatId - ID del chat a seleccionar
 */
async function selectConversation(chatId) {
  try {
    // Buscar conversación
    const conversation = activeConversations.find(conv => conv.chatId === chatId);
    if (!conversation) return;
    
    // Actualizar selección
    selectedConversation = conversation;
    
    // Actualizar UI
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.chatId === chatId);
    });
    
    // Mostrar panel de conversación
    const conversationPanel = document.getElementById('conversation-panel');
    if (conversationPanel) {
      conversationPanel.style.display = 'flex';
    }
    
    // Actualizar información del cliente
    document.getElementById('client-name').textContent = conversation.name;
    document.getElementById('client-phone').textContent = conversation.phone;
    document.getElementById('client-status').textContent = conversation.status;
    
    // Solicitar mensajes al proceso principal
    const messages = await ipcRenderer.invoke('get-chat-history', { chatId });
    
    // Renderizar mensajes
    renderMessages(messages);
    
    // Marcar como leído
    if (conversation.unreadCount > 0) {
      await ipcRenderer.invoke('mark-conversation-read', { chatId });
      refreshConversations();
    }
    
    // Actualizar botones según el estado
    updateActionButtons(conversation);
  } catch (error) {
    console.error('Error al seleccionar conversación:', error);
    showError('No se pudo cargar la conversación. Inténtalo de nuevo más tarde.');
  }
}

/**
 * Renderiza los mensajes de una conversación
 * @param {Array} messages - Lista de mensajes
 */
function renderMessages(messages) {
  const messagesContainer = document.getElementById('messages-container');
  if (!messagesContainer) return;
  
  // Limpiar contenedor
  messagesContainer.innerHTML = '';
  
  // Verificar si hay mensajes
  if (messages.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = 'No hay mensajes en esta conversación';
    messagesContainer.appendChild(emptyMessage);
    return;
  }
  
  // Crear elementos para cada mensaje
  messages.forEach(message => {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`;
    
    // Crear contenido
    messageElement.innerHTML = `
      <div class="message-content">${formatMessageContent(message.content)}</div>
      <div class="message-time">${formatTime(message.timestamp)}</div>
    `;
    
    // Añadir al contenedor
    messagesContainer.appendChild(messageElement);
  });
  
  // Desplazar al último mensaje
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Actualiza los botones de acción según el estado de la conversación
 * @param {Object} conversation - Datos de la conversación
 */
function updateActionButtons(conversation) {
  const takeOverButton = document.getElementById('take-over-button');
  const markResolvedButton = document.getElementById('mark-resolved-button');
  const sendMessageButton = document.getElementById('send-message-button');
  const messageInput = document.getElementById('message-input');
  
  if (takeOverButton && markResolvedButton && sendMessageButton && messageInput) {
    if (conversation.status === 'human_agent') {
      // Conversación ya tomada por un agente humano
      takeOverButton.style.display = 'none';
      markResolvedButton.style.display = 'block';
      sendMessageButton.disabled = false;
      messageInput.disabled = false;
    } else if (conversation.status === 'resolved') {
      // Conversación resuelta
      takeOverButton.style.display = 'block';
      markResolvedButton.style.display = 'none';
      sendMessageButton.disabled = true;
      messageInput.disabled = true;
    } else {
      // Conversación gestionada por IA
      takeOverButton.style.display = 'block';
      markResolvedButton.style.display = 'none';
      sendMessageButton.disabled = true;
      messageInput.disabled = true;
    }
  }
}

/**
 * Toma el control de una conversación
 */
async function takeOverConversation() {
  if (!selectedConversation) return;
  
  try {
    // Solicitar tomar el control al proceso principal
    await ipcRenderer.invoke('take-over-conversation', {
      chatId: selectedConversation.chatId
    });
    
    // Actualizar estado local
    selectedConversation.status = 'human_agent';
    
    // Actualizar UI
    updateActionButtons(selectedConversation);
    
    // Habilitar envío de mensajes
    document.getElementById('send-message-button').disabled = false;
    document.getElementById('message-input').disabled = false;
    
    // Enviar mensaje automático
    await ipcRenderer.invoke('send-message', {
      chatId: selectedConversation.chatId,
      message: 'Hola, soy un agente humano. ¿En qué puedo ayudarte?'
    });
    
    // Actualizar conversaciones
    refreshConversations();
  } catch (error) {
    console.error('Error al tomar el control de la conversación:', error);
    showError('No se pudo tomar el control de la conversación. Inténtalo de nuevo más tarde.');
  }
}

/**
 * Marca una conversación como resuelta
 */
async function markConversationResolved() {
  if (!selectedConversation) return;
  
  try {
    // Solicitar marcar como resuelta al proceso principal
    await ipcRenderer.invoke('mark-conversation-resolved', {
      chatId: selectedConversation.chatId
    });
    
    // Actualizar estado local
    selectedConversation.status = 'resolved';
    
    // Actualizar UI
    updateActionButtons(selectedConversation);
    
    // Deshabilitar envío de mensajes
    document.getElementById('send-message-button').disabled = true;
    document.getElementById('message-input').disabled = true;
    
    // Actualizar conversaciones
    refreshConversations();
  } catch (error) {
    console.error('Error al marcar la conversación como resuelta:', error);
    showError('No se pudo marcar la conversación como resuelta. Inténtalo de nuevo más tarde.');
  }
}

/**
 * Envía un mensaje a la conversación seleccionada
 */
async function sendMessage() {
  if (!selectedConversation) return;
  
  const messageInput = document.getElementById('message-input');
  if (!messageInput) return;
  
  const message = messageInput.value.trim();
  if (!message) return;
  
  try {
    // Limpiar input
    messageInput.value = '';
    
    // Enviar mensaje
    await ipcRenderer.invoke('send-message', {
      chatId: selectedConversation.chatId,
      message
    });
    
    // Actualizar conversación
    const chatId = selectedConversation.chatId;
    const messages = await ipcRenderer.invoke('get-chat-history', { chatId });
    renderMessages(messages);
    
    // Actualizar conversaciones
    refreshConversations();
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    showError('No se pudo enviar el mensaje. Inténtalo de nuevo más tarde.');
  }
}

/**
 * Formatea el contenido de un mensaje para mostrarlo en la UI
 * @param {string} content - Contenido del mensaje
 * @returns {string} - Contenido formateado
 */
function formatMessageContent(content) {
  // Escapar HTML
  let formattedContent = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Convertir URLs en enlaces
  formattedContent = formattedContent.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank">$1</a>'
  );
  
  // Convertir saltos de línea en <br>
  formattedContent = formattedContent.replace(/\n/g, '<br>');
  
  return formattedContent;
}

/**
 * Formatea una marca de tiempo para mostrarla en la UI
 * @param {number|string} timestamp - Marca de tiempo
 * @returns {string} - Tiempo formateado
 */
function formatTime(timestamp) {
  const date = new Date(typeof timestamp === 'number' ? timestamp * 1000 : timestamp);
  const now = new Date();
  const diff = now - date;
  
  // Si es hoy, mostrar solo la hora
  if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Si es ayer, mostrar "Ayer" y la hora
  if (diff < 48 * 60 * 60 * 1000 && date.getDate() === now.getDate() - 1) {
    return `Ayer ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Si es esta semana, mostrar el día de la semana y la hora
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return `${days[date.getDay()]} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // En otro caso, mostrar la fecha completa
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/**
 * Muestra un mensaje de error
 * @param {string} message - Mensaje de error
 */
function showError(message) {
  const errorElement = document.getElementById('conversation-error');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Ocultar después de 5 segundos
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 5000);
  }
}

/**
 * Limpia los recursos al cerrar la página
 */
function cleanupConversationManager() {
  // Detener actualización automática
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
}

// Exportar funciones
module.exports = {
  initializeConversationManager,
  refreshConversations,
  cleanupConversationManager
};
