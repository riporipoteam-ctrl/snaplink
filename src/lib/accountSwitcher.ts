export interface LinkedAccount {
  uid: string;
  displayName: string;
  username: string;
  photoURL?: string;
  loginLink: string;
  updatedAt: string;
}

const LINKED_ACCOUNTS_KEY = 'snaplink_linked_accounts';
const LINKED_ACCOUNT_OWNER_KEY = 'snaplink_linked_account_owner';
export const MAX_LINKED_ACCOUNTS = 5;

function getScopedAccountsKey(ownerUid?: string | null) {
  return ownerUid ? `${LINKED_ACCOUNTS_KEY}::${ownerUid}` : LINKED_ACCOUNTS_KEY;
}

function sortAccounts(accounts: LinkedAccount[]) {
  return [...accounts]
    .filter((account) => account?.uid && account?.loginLink)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, MAX_LINKED_ACCOUNTS);
}

export function getLinkedAccounts(ownerUid?: string | null) {
  if (typeof window === 'undefined') return [] as LinkedAccount[];

  try {
    const scopedKey = getScopedAccountsKey(ownerUid);
    const rawAccounts = window.localStorage.getItem(scopedKey);

    if (!rawAccounts && ownerUid) {
      const legacyAccounts = window.localStorage.getItem(LINKED_ACCOUNTS_KEY);
      if (legacyAccounts) {
        window.localStorage.setItem(scopedKey, legacyAccounts);
        window.localStorage.removeItem(LINKED_ACCOUNTS_KEY);
      }
    }

    const finalRawAccounts = window.localStorage.getItem(scopedKey);
    if (!finalRawAccounts) return [];

    const parsed = JSON.parse(finalRawAccounts) as LinkedAccount[];
    if (!Array.isArray(parsed)) return [];

    return sortAccounts(parsed);
  } catch {
    return [];
  }
}

export function replaceLinkedAccounts(ownerUid: string | null | undefined, accounts: LinkedAccount[]) {
  if (typeof window === 'undefined') return [] as LinkedAccount[];

  const nextAccounts = sortAccounts(accounts);
  window.localStorage.setItem(getScopedAccountsKey(ownerUid), JSON.stringify(nextAccounts));
  return nextAccounts;
}

export function mergeLinkedAccounts(ownerUid: string | null | undefined, ...accountGroups: LinkedAccount[][]) {
  const merged = new Map<string, LinkedAccount>();

  accountGroups.flat().forEach((account) => {
    if (!account?.uid || !account?.loginLink) return;
    const existing = merged.get(account.uid);
    if (!existing || new Date(account.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      merged.set(account.uid, account);
    }
  });

  return replaceLinkedAccounts(ownerUid, Array.from(merged.values()));
}

export function saveLinkedAccount(ownerUid: string | null | undefined, account: Omit<LinkedAccount, 'updatedAt'> & { updatedAt?: string }) {
  const nextAccount: LinkedAccount = {
    ...account,
    updatedAt: account.updatedAt || new Date().toISOString(),
  };

  return mergeLinkedAccounts(ownerUid, [nextAccount], getLinkedAccounts(ownerUid));
}

export function removeLinkedAccount(ownerUid: string | null | undefined, uid: string) {
  const nextAccounts = getLinkedAccounts(ownerUid).filter((account) => account.uid !== uid);
  return replaceLinkedAccounts(ownerUid, nextAccounts);
}

export function getLinkedAccountOwner() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(LINKED_ACCOUNT_OWNER_KEY);
}

export function setLinkedAccountOwner(uid: string | null) {
  if (typeof window === 'undefined') return;
  if (!uid) {
    window.localStorage.removeItem(LINKED_ACCOUNT_OWNER_KEY);
    return;
  }
  window.localStorage.setItem(LINKED_ACCOUNT_OWNER_KEY, uid);
}
