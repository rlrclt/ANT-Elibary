"use client";

import { useActionState } from "react";
import {
  loginAction,
  registerAction,
  type LoginState,
  type RegisterState,
} from "../actions/auth";

/** ใช้กับฟอร์ม login */
export function useLoginAction() {
  return useActionState<LoginState, FormData>(loginAction, {});
}

/** ใช้กับฟอร์ม register */
export function useRegisterAction() {
  return useActionState<RegisterState, FormData>(registerAction, {});
}