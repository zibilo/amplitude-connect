/**
 * MUCO-AMPLITUDE: Utilitaires de hachage et sécurité
 * SHA-256 pour intégrité des fichiers
 */

import CryptoJS from 'crypto-js';

/**
 * Calculer le hash SHA-256 d'une chaîne
 */
export function hashString(content: string): string {
  return CryptoJS.SHA256(content).toString(CryptoJS.enc.Hex);
}

/**
 * Calculer le hash SHA-256 d'un fichier
 */
export async function hashFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const hash = CryptoJS.SHA256(CryptoJS.enc.Latin1.parse(content)).toString(CryptoJS.enc.Hex);
        resolve(hash);
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = () => reject(new Error('Erreur lecture fichier'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Calculer le hash SHA-256 d'un ArrayBuffer
 */
export function hashArrayBuffer(buffer: ArrayBuffer): string {
  const wordArray = CryptoJS.lib.WordArray.create(buffer as unknown as number[]);
  return CryptoJS.SHA256(wordArray).toString(CryptoJS.enc.Hex);
}

/**
 * Vérifier l'intégrité d'un fichier
 */
export async function verifyFileIntegrity(file: File, expectedHash: string): Promise<boolean> {
  const actualHash = await hashFile(file);
  return actualHash.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Générer un checksum pour validation rapide
 */
export function generateChecksum(data: unknown[]): string {
  const json = JSON.stringify(data);
  return CryptoJS.MD5(json).toString(CryptoJS.enc.Hex);
}

/**
 * Créer une signature pour un fichier généré
 * Inclut: hash du contenu, timestamp, nombre d'entrées, montant total
 */
export function createFileSignature(
  content: string,
  entriesCount: number,
  totalAmount: number
): {
  hash: string;
  signature: string;
  timestamp: string;
} {
  const timestamp = new Date().toISOString();
  const hash = hashString(content);
  
  // Créer une signature combinée
  const signatureData = `${hash}|${timestamp}|${entriesCount}|${totalAmount}`;
  const signature = CryptoJS.SHA256(signatureData).toString(CryptoJS.enc.Hex);
  
  return { hash, signature, timestamp };
}

/**
 * Vérifier une signature de fichier
 */
export function verifyFileSignature(
  content: string,
  entriesCount: number,
  totalAmount: number,
  expectedHash: string,
  expectedSignature: string,
  timestamp: string
): boolean {
  const actualHash = hashString(content);
  
  if (actualHash !== expectedHash) {
    return false;
  }
  
  const signatureData = `${actualHash}|${timestamp}|${entriesCount}|${totalAmount}`;
  const actualSignature = CryptoJS.SHA256(signatureData).toString(CryptoJS.enc.Hex);
  
  return actualSignature === expectedSignature;
}

/**
 * Générer un ID de session unique
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2);
  return CryptoJS.SHA256(`${timestamp}-${random}`).toString(CryptoJS.enc.Hex).substring(0, 32);
}

/**
 * Masquer les données sensibles pour les logs
 */
export function maskSensitiveData(rib: string): string {
  if (rib.length < 10) return '****';
  return `${rib.substring(0, 5)}${'*'.repeat(rib.length - 9)}${rib.substring(rib.length - 4)}`;
}
