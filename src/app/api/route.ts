/**
 * API ドキュメント エンドポイント
 *
 * 利用可能な API エンドポイント一覧を JSON で返す。
 * 開発者向けの API サーフェス概要。
 */
import { NextResponse } from 'next/server';

export async function GET() {
  const endpoints = [
    {
      path: '/api/health',
      method: 'GET',
      auth: false,
      description: 'Health check - returns service status, DB connectivity, and version',
    },
    {
      path: '/api/auth/*',
      method: 'GET | POST',
      auth: false,
      description: 'NextAuth.js authentication endpoints (signin, signout, session, etc.)',
    },
    {
      path: '/api/signup',
      method: 'POST',
      auth: false,
      description: 'User registration with email/password',
    },
    {
      path: '/api/organizations',
      method: 'GET | POST',
      auth: true,
      description: 'List or create organizations',
    },
    {
      path: '/api/companies',
      method: 'GET | POST',
      auth: true,
      description: 'List or create companies within an organization',
    },
    {
      path: '/api/simulations',
      method: 'GET | POST',
      auth: true,
      description: 'List or create keishin (P-score) simulations',
    },
    {
      path: '/api/ai-analysis',
      method: 'POST',
      auth: true,
      description: 'AI-powered analysis of keishin simulation results',
    },
    {
      path: '/api/export-excel',
      method: 'POST',
      auth: true,
      description: 'Export simulation data as Excel file',
    },
    {
      path: '/api/export-pdf',
      method: 'POST',
      auth: true,
      description: 'Export simulation data as PDF file',
    },
    {
      path: '/api/parse-pdf',
      method: 'POST',
      auth: true,
      description: 'Parse uploaded PDF documents',
    },
    {
      path: '/api/parse-excel',
      method: 'POST',
      auth: true,
      description: 'Parse uploaded Excel files',
    },
    {
      path: '/api/parse-keishin-pdf',
      method: 'POST',
      auth: true,
      description: 'Parse keishin-specific PDF documents',
    },
    {
      path: '/api/parse-result-pdf',
      method: 'POST',
      auth: true,
      description: 'Parse keishin result notification PDFs',
    },
    {
      path: '/api/stripe/create-checkout-session',
      method: 'POST',
      auth: true,
      description: 'Create a Stripe Checkout session for subscription',
    },
    {
      path: '/api/stripe/create-portal-session',
      method: 'POST',
      auth: true,
      description: 'Create a Stripe Customer Portal session for billing management',
    },
    {
      path: '/api/webhooks/stripe',
      method: 'POST',
      auth: false,
      description: 'Stripe webhook receiver for subscription events',
    },
    {
      path: '/api/admin/*',
      method: 'GET | POST | PUT | DELETE',
      auth: true,
      description: 'Admin-only endpoints for user/organization/simulation management',
    },
    {
      path: '/api/seed-admin',
      method: 'POST',
      auth: false,
      description: 'Seed initial admin user (development only)',
    },
  ];

  return NextResponse.json({
    name: 'keishin-cloud API',
    version: process.env.npm_package_version ?? '0.1.0',
    endpoints,
  });
}
