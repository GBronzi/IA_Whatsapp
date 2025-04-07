/**
 * models/ml-models.js - Modelos de aprendizaje automático simplificados
 * 
 * Nota: Estos son modelos simplificados para demostración.
 * En un entorno de producción, se recomienda usar bibliotecas como
 * TensorFlow.js, Brain.js o ML.js para implementaciones más robustas.
 */

/**
 * Modelo de regresión lineal simple
 */
class LinearRegression {
  constructor() {
    this.weights = null;
    this.bias = 0;
  }
  
  /**
   * Entrena el modelo con datos de entrada y salida
   * @param {Array} X - Datos de entrada (array de arrays)
   * @param {Array} y - Datos de salida (array)
   */
  fit(X, y) {
    if (X.length !== y.length || X.length === 0) {
      throw new Error('Los datos de entrada y salida deben tener la misma longitud y no estar vacíos');
    }
    
    const n = X.length;
    const numFeatures = X[0].length;
    
    // Inicializar pesos
    this.weights = Array(numFeatures).fill(0);
    this.bias = 0;
    
    // Hiperparámetros
    const learningRate = 0.01;
    const iterations = 1000;
    
    // Descenso de gradiente
    for (let iter = 0; iter < iterations; iter++) {
      // Calcular predicciones
      const predictions = X.map(x => this.predict([x]));
      
      // Calcular gradientes
      const gradWeights = Array(numFeatures).fill(0);
      let gradBias = 0;
      
      for (let i = 0; i < n; i++) {
        const error = predictions[i] - y[i];
        
        for (let j = 0; j < numFeatures; j++) {
          gradWeights[j] += error * X[i][j];
        }
        
        gradBias += error;
      }
      
      // Actualizar pesos y bias
      for (let j = 0; j < numFeatures; j++) {
        this.weights[j] -= learningRate * gradWeights[j] / n;
      }
      
      this.bias -= learningRate * gradBias / n;
    }
  }
  
  /**
   * Realiza predicciones con el modelo entrenado
   * @param {Array} X - Datos de entrada (array de arrays)
   * @returns {number|Array} - Predicción o array de predicciones
   */
  predict(X) {
    if (!this.weights) {
      throw new Error('El modelo debe ser entrenado antes de hacer predicciones');
    }
    
    if (X.length === 1) {
      // Predicción única
      let prediction = this.bias;
      
      for (let j = 0; j < this.weights.length; j++) {
        prediction += this.weights[j] * X[0][j];
      }
      
      return prediction;
    } else {
      // Múltiples predicciones
      return X.map(x => {
        let prediction = this.bias;
        
        for (let j = 0; j < this.weights.length; j++) {
          prediction += this.weights[j] * x[j];
        }
        
        return prediction;
      });
    }
  }
}

/**
 * Modelo de clustering K-Means
 */
class KMeans {
  constructor(k = 3, maxIterations = 100) {
    this.k = k;
    this.maxIterations = maxIterations;
    this.centroids = null;
  }
  
  /**
   * Entrena el modelo con datos de entrada
   * @param {Array} X - Datos de entrada (array de arrays)
   * @returns {Array} - Asignaciones de cluster para cada punto
   */
  fit(X) {
    if (X.length === 0) {
      throw new Error('Los datos de entrada no pueden estar vacíos');
    }
    
    const n = X.length;
    const numFeatures = X[0].length;
    
    // Inicializar centroides aleatoriamente
    this.centroids = [];
    
    // Usar K-Means++ para inicialización
    // Elegir el primer centroide aleatoriamente
    const firstIndex = Math.floor(Math.random() * n);
    this.centroids.push([...X[firstIndex]]);
    
    // Elegir el resto de centroides
    for (let i = 1; i < this.k; i++) {
      // Calcular distancias al cuadrado a los centroides más cercanos
      const distances = X.map(x => {
        const minDist = Math.min(...this.centroids.map(c => this.distance(x, c)));
        return minDist * minDist;
      });
      
      // Calcular probabilidades
      const sum = distances.reduce((a, b) => a + b, 0);
      const probabilities = distances.map(d => d / sum);
      
      // Elegir el siguiente centroide
      let r = Math.random();
      let j = 0;
      
      while (r > 0 && j < n) {
        r -= probabilities[j];
        j++;
      }
      
      this.centroids.push([...X[j - 1]]);
    }
    
    // Asignaciones de cluster
    let assignments = Array(n).fill(0);
    let iterations = 0;
    let changed = true;
    
    // Iterar hasta convergencia o máximo de iteraciones
    while (changed && iterations < this.maxIterations) {
      changed = false;
      iterations++;
      
      // Asignar puntos a centroides
      for (let i = 0; i < n; i++) {
        const clusterIndex = this.predict(X[i]);
        
        if (clusterIndex !== assignments[i]) {
          assignments[i] = clusterIndex;
          changed = true;
        }
      }
      
      // Actualizar centroides
      const newCentroids = Array(this.k).fill().map(() => Array(numFeatures).fill(0));
      const counts = Array(this.k).fill(0);
      
      for (let i = 0; i < n; i++) {
        const clusterIndex = assignments[i];
        counts[clusterIndex]++;
        
        for (let j = 0; j < numFeatures; j++) {
          newCentroids[clusterIndex][j] += X[i][j];
        }
      }
      
      for (let i = 0; i < this.k; i++) {
        if (counts[i] > 0) {
          for (let j = 0; j < numFeatures; j++) {
            newCentroids[i][j] /= counts[i];
          }
          this.centroids[i] = newCentroids[i];
        }
      }
    }
    
    return assignments;
  }
  
  /**
   * Predice el cluster al que pertenece un punto
   * @param {Array} x - Punto a clasificar
   * @returns {number} - Índice del cluster
   */
  predict(x) {
    if (!this.centroids) {
      throw new Error('El modelo debe ser entrenado antes de hacer predicciones');
    }
    
    let minDist = Infinity;
    let clusterIndex = 0;
    
    for (let i = 0; i < this.k; i++) {
      const dist = this.distance(x, this.centroids[i]);
      
      if (dist < minDist) {
        minDist = dist;
        clusterIndex = i;
      }
    }
    
    return clusterIndex;
  }
  
  /**
   * Calcula la distancia euclidiana entre dos puntos
   * @param {Array} a - Primer punto
   * @param {Array} b - Segundo punto
   * @returns {number} - Distancia euclidiana
   */
  distance(a, b) {
    return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
  }
}

/**
 * Modelo de Naive Bayes para clasificación
 */
class NaiveBayes {
  constructor() {
    this.priors = null;
    this.means = null;
    this.variances = null;
    this.classes = null;
  }
  
  /**
   * Entrena el modelo con datos de entrada y etiquetas
   * @param {Array} X - Datos de entrada (array de arrays)
   * @param {Array} y - Etiquetas (array)
   */
  fit(X, y) {
    if (X.length !== y.length || X.length === 0) {
      throw new Error('Los datos de entrada y etiquetas deben tener la misma longitud y no estar vacíos');
    }
    
    const n = X.length;
    const numFeatures = X[0].length;
    
    // Obtener clases únicas
    this.classes = [...new Set(y)];
    const numClasses = this.classes.length;
    
    // Inicializar parámetros
    this.priors = Array(numClasses).fill(0);
    this.means = Array(numClasses).fill().map(() => Array(numFeatures).fill(0));
    this.variances = Array(numClasses).fill().map(() => Array(numFeatures).fill(0));
    
    // Calcular priors y medias
    const counts = Array(numClasses).fill(0);
    
    for (let i = 0; i < n; i++) {
      const classIndex = this.classes.indexOf(y[i]);
      counts[classIndex]++;
      
      for (let j = 0; j < numFeatures; j++) {
        this.means[classIndex][j] += X[i][j];
      }
    }
    
    for (let i = 0; i < numClasses; i++) {
      this.priors[i] = counts[i] / n;
      
      for (let j = 0; j < numFeatures; j++) {
        this.means[i][j] /= counts[i];
      }
    }
    
    // Calcular varianzas
    for (let i = 0; i < n; i++) {
      const classIndex = this.classes.indexOf(y[i]);
      
      for (let j = 0; j < numFeatures; j++) {
        this.variances[classIndex][j] += Math.pow(X[i][j] - this.means[classIndex][j], 2);
      }
    }
    
    for (let i = 0; i < numClasses; i++) {
      for (let j = 0; j < numFeatures; j++) {
        this.variances[i][j] /= counts[i];
        
        // Evitar varianza cero (suavizado)
        this.variances[i][j] = Math.max(this.variances[i][j], 1e-10);
      }
    }
  }
  
  /**
   * Predice la clase de un punto
   * @param {Array} x - Punto a clasificar
   * @returns {number} - Clase predicha
   */
  predict(x) {
    if (!this.priors) {
      throw new Error('El modelo debe ser entrenado antes de hacer predicciones');
    }
    
    const probabilities = this.predictProbabilities(x);
    let maxProb = -Infinity;
    let predictedClass = this.classes[0];
    
    for (let i = 0; i < this.classes.length; i++) {
      if (probabilities[i] > maxProb) {
        maxProb = probabilities[i];
        predictedClass = this.classes[i];
      }
    }
    
    return predictedClass;
  }
  
  /**
   * Calcula las probabilidades de cada clase
   * @param {Array} x - Punto a clasificar
   * @returns {Array} - Probabilidades para cada clase
   */
  predictProbabilities(x) {
    if (!this.priors) {
      throw new Error('El modelo debe ser entrenado antes de hacer predicciones');
    }
    
    const numFeatures = x.length;
    const logProbs = Array(this.classes.length).fill(0);
    
    for (let i = 0; i < this.classes.length; i++) {
      // Prior (en logaritmo)
      logProbs[i] = Math.log(this.priors[i]);
      
      // Likelihood (en logaritmo)
      for (let j = 0; j < numFeatures; j++) {
        const mean = this.means[i][j];
        const variance = this.variances[i][j];
        
        // Densidad de probabilidad gaussiana (en logaritmo)
        const logLikelihood = -0.5 * Math.log(2 * Math.PI * variance) - 
                              0.5 * Math.pow(x[j] - mean, 2) / variance;
        
        logProbs[i] += logLikelihood;
      }
    }
    
    // Convertir de logaritmos a probabilidades
    const maxLogProb = Math.max(...logProbs);
    const expProbs = logProbs.map(p => Math.exp(p - maxLogProb));
    const sumExpProbs = expProbs.reduce((a, b) => a + b, 0);
    
    return expProbs.map(p => p / sumExpProbs);
  }
  
  /**
   * Calcula la probabilidad de una clase específica
   * @param {Array} x - Punto a clasificar
   * @param {number} classIndex - Índice de la clase (opcional)
   * @returns {number} - Probabilidad
   */
  predictProbability(x, classIndex = 1) {
    const probabilities = this.predictProbabilities(x);
    return probabilities[classIndex];
  }
}

module.exports = {
  LinearRegression,
  KMeans,
  NaiveBayes
};
