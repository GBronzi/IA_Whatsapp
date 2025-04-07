/**
 * main.js - Script principal para el panel de administración
 */

document.addEventListener('DOMContentLoaded', function() {
  // Toggle sidebar en dispositivos móviles
  const toggleSidebarBtn = document.getElementById('toggleSidebar');
  const sidebar = document.getElementById('sidebar');
  
  if (toggleSidebarBtn && sidebar) {
    toggleSidebarBtn.addEventListener('click', function() {
      sidebar.classList.toggle('show');
    });
  }
  
  // Cerrar sidebar al hacer clic fuera de él en dispositivos móviles
  document.addEventListener('click', function(event) {
    const isClickInsideSidebar = sidebar && sidebar.contains(event.target);
    const isClickOnToggleBtn = toggleSidebarBtn && toggleSidebarBtn.contains(event.target);
    
    if (sidebar && sidebar.classList.contains('show') && !isClickInsideSidebar && !isClickOnToggleBtn) {
      sidebar.classList.remove('show');
    }
  });
  
  // Inicializar tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function(tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
  
  // Inicializar popovers
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
  popoverTriggerList.map(function(popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });
  
  // Manejar formularios de búsqueda
  const searchForms = document.querySelectorAll('.search-form');
  
  searchForms.forEach(form => {
    form.addEventListener('submit', function(event) {
      const searchInput = this.querySelector('input[type="search"]');
      
      if (!searchInput || searchInput.value.trim() === '') {
        event.preventDefault();
      }
    });
  });
  
  // Manejar confirmaciones de eliminación
  const deleteButtons = document.querySelectorAll('[data-confirm]');
  
  deleteButtons.forEach(button => {
    button.addEventListener('click', function(event) {
      const message = this.dataset.confirm || '¿Está seguro de que desea eliminar este elemento?';
      
      if (!confirm(message)) {
        event.preventDefault();
      }
    });
  });
  
  // Manejar formularios AJAX
  const ajaxForms = document.querySelectorAll('form[data-ajax="true"]');
  
  ajaxForms.forEach(form => {
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      
      const formData = new FormData(this);
      const url = this.action;
      const method = this.method.toUpperCase();
      const submitButton = this.querySelector('[type="submit"]');
      const feedbackElement = document.getElementById(this.dataset.feedback);
      
      // Deshabilitar botón de envío
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...';
      }
      
      // Convertir FormData a objeto JSON si es necesario
      let body;
      if (this.dataset.format === 'json') {
        const jsonData = {};
        formData.forEach((value, key) => {
          jsonData[key] = value;
        });
        body = JSON.stringify(jsonData);
      } else {
        body = formData;
      }
      
      // Realizar petición
      fetch(url, {
        method: method,
        body: body,
        headers: this.dataset.format === 'json' ? { 'Content-Type': 'application/json' } : {},
        credentials: 'same-origin'
      })
        .then(response => response.json())
        .then(data => {
          // Mostrar feedback
          if (feedbackElement) {
            feedbackElement.innerHTML = `
              <div class="alert alert-${data.success ? 'success' : 'danger'} alert-dismissible fade show" role="alert">
                ${data.message || (data.success ? 'Operación completada con éxito' : 'Error al procesar la solicitud')}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
              </div>
            `;
          }
          
          // Ejecutar callback si existe
          if (data.success && this.dataset.callback) {
            const callback = window[this.dataset.callback];
            if (typeof callback === 'function') {
              callback(data);
            }
          }
          
          // Redireccionar si es necesario
          if (data.success && this.dataset.redirect) {
            window.location.href = this.dataset.redirect;
          }
          
          // Resetear formulario si es necesario
          if (data.success && this.dataset.reset === 'true') {
            this.reset();
          }
        })
        .catch(error => {
          console.error('Error:', error);
          
          // Mostrar feedback
          if (feedbackElement) {
            feedbackElement.innerHTML = `
              <div class="alert alert-danger alert-dismissible fade show" role="alert">
                Error al procesar la solicitud
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
              </div>
            `;
          }
        })
        .finally(() => {
          // Restaurar botón de envío
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = submitButton.dataset.originalText || 'Enviar';
          }
        });
    });
    
    // Guardar texto original del botón
    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) {
      submitButton.dataset.originalText = submitButton.innerHTML;
    }
  });
});
