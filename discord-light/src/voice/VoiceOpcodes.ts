export const VoiceOpcodes = {
  IDENTIFY: 0,
  SELECT_PROTOCOL: 1,
  READY: 2,
  HEARTBEAT: 3,
  SESSION_DESCRIPTION: 4,
  SPEAKING: 5,
  HEARTBEAT_ACK: 6,
  RESUME: 7,
  HELLO: 8,
  RESUMED: 9,
  CLIENT_DISCONNECT: 13,
} as const;

export const VoiceEncryptionModes = {
  XSALSA20_POLY1305: 'xsalsa20_poly1305',
  XSALSA20_POLY1305_SUFFIX: 'xsalsa20_poly1305_suffix',
  XSALSA20_POLY1305_LITE: 'xsalsa20_poly1305_lite',
  AEAD_AES256_GCM: 'aead_aes256_gcm',
  AEAD_AES256_GCM_RTPSIZE: 'aead_aes256_gcm_rtpsize',
} as const;
