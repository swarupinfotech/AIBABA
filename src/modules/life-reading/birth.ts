import { decryptField } from "@/lib/security/crypto";
import { prisma } from "@/lib/database/prisma";

export async function decryptedBirthForReading(readingId: string) {
  const reading = await prisma.completeReading.findUnique({
    where: { id: readingId },
    include: { birthProfile: true },
  });
  if (!reading?.birthProfile) return { reading, birth: null };
  const profile = reading.birthProfile;
  let fullName: string | null = null;
  let dateOfBirth: string | null = null;
  try {
    if (profile.encryptedFullName) fullName = decryptField(profile.encryptedFullName);
    if (profile.encryptedDateOfBirth) dateOfBirth = decryptField(profile.encryptedDateOfBirth);
  } catch {
    throw new Error("BIRTH_PROFILE_DECRYPTION_FAILED");
  }
  return {
    reading,
    birth: {
      fullName,
      dateOfBirth,
      birthTime: profile.birthTime,
      birthTimeAccuracy: profile.birthTimeAccuracy,
      birthplaceName: profile.birthplaceName,
      latitude: profile.latitude,
      longitude: profile.longitude,
      timezone: profile.timezone,
    },
  };
}
