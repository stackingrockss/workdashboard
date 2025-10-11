import { Account } from "@/types/account";
import { AccountCreateInput, AccountUpdateInput } from "../validations/account";

const API_BASE = "/api/v1";

export interface GetAccountsResponse {
  accounts: Account[];
}

export interface GetAccountResponse {
  account: Account;
}

export interface CreateAccountResponse {
  account: Account;
}

export interface UpdateAccountResponse {
  account: Account;
}

export interface DeleteAccountResponse {
  ok: boolean;
}

export interface ErrorResponse {
  error: string;
}

export async function getAccounts(): Promise<Account[]> {
  const response = await fetch(`${API_BASE}/accounts`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch accounts");
  }

  const data: GetAccountsResponse = await response.json();
  return data.accounts;
}

export async function getAccount(id: string): Promise<Account> {
  const response = await fetch(`${API_BASE}/accounts/${id}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Account not found");
    }
    throw new Error("Failed to fetch account");
  }

  const data: GetAccountResponse = await response.json();
  return data.account;
}

export async function createAccount(
  input: AccountCreateInput
): Promise<Account> {
  const response = await fetch(`${API_BASE}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || "Failed to create account");
  }

  const data: CreateAccountResponse = await response.json();
  return data.account;
}

export async function updateAccount(
  id: string,
  input: AccountUpdateInput
): Promise<Account> {
  const response = await fetch(`${API_BASE}/accounts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || "Failed to update account");
  }

  const data: UpdateAccountResponse = await response.json();
  return data.account;
}

export async function deleteAccount(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/accounts/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || "Failed to delete account");
  }
}
