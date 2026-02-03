#!/usr/bin/env tsx
/**
 * Script to check Firebase service account configuration
 * 
 * This script verifies:
 * 1. Service account files exist in service-accounts/ directory
 * 2. Environment variables are set (for Vercel/production)
 * 3. Service account JSON files are valid
 * 4. Required fields are present in each service account
 */

import fs from 'fs';
import path from 'path';
import { FirebaseProjectType } from '../src/lib/projects';

interface ServiceAccountCheck {
  projectType: FirebaseProjectType;
  envVar: string;
  pathVar: string;
  fileExists: boolean;
  filePath?: string;
  envVarSet: boolean;
  isValid: boolean;
  errors: string[];
  projectId?: string;
  clientEmail?: string;
}

const PROJECT_TYPES: FirebaseProjectType[] = ['admin', 'prepcenter', 'hive'];

// Expected filenames based on README and .env.example
const EXPECTED_FILES: Record<FirebaseProjectType, string> = {
  admin: 'hiveadmin-fb9e0-firebase-adminsdk-fbsvc-8429a5d36f.json',
  prepcenter: 'prepcenter-750c1-firebase-adminsdk-fbsvc-7e15094e23.json',
  hive: 'beeapp-5c98b-firebase-adminsdk-g6vl0-0c34f5c176.json',
};

function checkServiceAccount(projectType: FirebaseProjectType): ServiceAccountCheck {
  const envKey = `FIREBASE_SERVICE_ACCOUNT_${projectType.toUpperCase()}`;
  const pathKey = `FIREBASE_SERVICE_ACCOUNT_PATH_${projectType.toUpperCase()}`;
  
  const check: ServiceAccountCheck = {
    projectType,
    envVar: envKey,
    pathVar: pathKey,
    fileExists: false,
    envVarSet: !!process.env[envKey],
    isValid: false,
    errors: [],
  };

  // Check if environment variable is set
  const envValue = process.env[envKey];
  const pathValue = process.env[pathKey];

  // Check for file path
  if (pathValue) {
    const resolvedPath = path.isAbsolute(pathValue)
      ? pathValue
      : path.resolve(process.cwd(), pathValue);
    
    check.filePath = resolvedPath;
    check.fileExists = fs.existsSync(resolvedPath);
    
    if (check.fileExists) {
      try {
        const fileContent = fs.readFileSync(resolvedPath, 'utf8');
        const serviceAccount = JSON.parse(fileContent);
        
        // Validate required fields
        if (!serviceAccount.private_key) {
          check.errors.push('Missing private_key field');
        }
        if (!serviceAccount.client_email) {
          check.errors.push('Missing client_email field');
        }
        if (!serviceAccount.project_id) {
          check.errors.push('Missing project_id field');
        }
        
        if (serviceAccount.project_id) {
          check.projectId = serviceAccount.project_id;
        }
        if (serviceAccount.client_email) {
          check.clientEmail = serviceAccount.client_email;
        }
        
        // Validate private key format
        if (serviceAccount.private_key) {
          const privateKey = serviceAccount.private_key.replace(/\\n/g, '\n');
          if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
            check.errors.push('Invalid private key format');
          }
        }
        
        check.isValid = check.errors.length === 0;
      } catch (error: any) {
        check.errors.push(`Error reading/parsing file: ${error.message}`);
      }
    } else {
      check.errors.push(`File not found at: ${resolvedPath}`);
    }
  } else {
    // Check expected file location
    const expectedFile = EXPECTED_FILES[projectType];
    const serviceAccountsDir = path.resolve(process.cwd(), 'service-accounts');
    const expectedPath = path.join(serviceAccountsDir, expectedFile);
    
    check.filePath = expectedPath;
    check.fileExists = fs.existsSync(expectedPath);
    
    if (!check.fileExists) {
      check.errors.push(`Expected file not found: ${expectedFile}`);
    } else {
      // Validate the file
      try {
        const fileContent = fs.readFileSync(expectedPath, 'utf8');
        const serviceAccount = JSON.parse(fileContent);
        
        if (!serviceAccount.private_key) {
          check.errors.push('Missing private_key field');
        }
        if (!serviceAccount.client_email) {
          check.errors.push('Missing client_email field');
        }
        if (!serviceAccount.project_id) {
          check.errors.push('Missing project_id field');
        }
        
        if (serviceAccount.project_id) {
          check.projectId = serviceAccount.project_id;
        }
        if (serviceAccount.client_email) {
          check.clientEmail = serviceAccount.client_email;
        }
        
        // Validate private key format
        if (serviceAccount.private_key) {
          const privateKey = serviceAccount.private_key.replace(/\\n/g, '\n');
          if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
            check.errors.push('Invalid private key format');
          }
        }
        
        check.isValid = check.errors.length === 0;
      } catch (error: any) {
        check.errors.push(`Error reading/parsing file: ${error.message}`);
      }
    }
  }

  // Check environment variable (for Vercel/production)
  if (envValue) {
    // Check if it's a placeholder
    const isPlaceholder = envValue.includes('"private_key":"..."') ||
                         envValue.includes('"private_key": "..."') ||
                         envValue.trim().length < 200;
    
    if (isPlaceholder) {
      check.errors.push('Environment variable appears to be a placeholder');
    } else {
      try {
        const parsed = JSON.parse(envValue);
        if (!parsed.private_key || !parsed.client_email || !parsed.project_id) {
          check.errors.push('Environment variable missing required fields');
        } else {
          if (!check.projectId) {
            check.projectId = parsed.project_id;
          }
          if (!check.clientEmail) {
            check.clientEmail = parsed.client_email;
          }
        }
      } catch (error: any) {
        check.errors.push(`Invalid JSON in environment variable: ${error.message}`);
      }
    }
  }

  return check;
}

function printResults(checks: ServiceAccountCheck[]) {
  console.log('\n🔍 Firebase Service Account Configuration Check\n');
  console.log('=' .repeat(80));
  
  let allValid = true;
  
  for (const check of checks) {
    const status = check.isValid && (check.fileExists || check.envVarSet) 
      ? '✅' 
      : '❌';
    
    console.log(`\n${status} ${check.projectType.toUpperCase()} Firebase`);
    console.log('-'.repeat(80));
    
    if (check.projectId) {
      console.log(`   Project ID: ${check.projectId}`);
    }
    if (check.clientEmail) {
      console.log(`   Client Email: ${check.clientEmail}`);
    }
    
    console.log(`\n   File Configuration:`);
    if (check.filePath) {
      console.log(`   - Path: ${check.filePath}`);
      console.log(`   - Exists: ${check.fileExists ? '✅' : '❌'}`);
    } else {
      console.log(`   - No file path configured`);
    }
    
    console.log(`\n   Environment Variables:`);
    console.log(`   - ${check.envVar}: ${check.envVarSet ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`   - ${check.pathVar}: ${process.env[check.pathVar] ? '✅ SET' : '❌ NOT SET'}`);
    
    if (check.errors.length > 0) {
      allValid = false;
      console.log(`\n   ⚠️  Errors:`);
      check.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
    }
    
    // Recommendations
    console.log(`\n   Recommendations:`);
    if (!check.fileExists && !check.envVarSet) {
      console.log(`   - Set ${check.pathVar} in .env.local pointing to service account file`);
      console.log(`   - OR set ${check.envVar} in Vercel environment variables (for production)`);
    } else if (check.fileExists && !check.envVarSet) {
      console.log(`   - ✅ Local development: File found`);
      console.log(`   - ⚠️  Production: Set ${check.envVar} in Vercel for deployment`);
    } else if (!check.fileExists && check.envVarSet) {
      console.log(`   - ✅ Production: Environment variable set`);
      console.log(`   - ⚠️  Local: Consider setting ${check.pathVar} for local development`);
    } else {
      console.log(`   - ✅ Both file and environment variable configured`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  
  if (allValid) {
    console.log('\n✅ All service accounts are properly configured!\n');
  } else {
    console.log('\n⚠️  Some service accounts need attention. See errors above.\n');
    process.exit(1);
  }
}

// Main execution
const checks = PROJECT_TYPES.map(checkServiceAccount);
printResults(checks);
