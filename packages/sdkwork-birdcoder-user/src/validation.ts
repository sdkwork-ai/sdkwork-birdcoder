import {
  USER_CENTER_VALIDATION_SOURCE_PACKAGE_NAME,
  createSdkworkCanonicalUserCenterValidationDefinition,
  type CreateSdkworkCanonicalUserCenterValidationPluginDefinitionOptions,
  type CreateSdkworkCanonicalUserCenterValidationPreflightOptions,
  type CreateSdkworkCanonicalUserCenterServerValidationPluginDefinitionOptions,
  type SdkworkCanonicalUserCenterValidationDefinition,
  type UserCenterServerValidationPluginDefinition,
  type UserCenterValidationInteropContract,
  type UserCenterValidationPluginDefinition,
  type UserCenterValidationPreflightReport,
  type UserCenterValidationSnapshot,
} from '@sdkwork/user-center-validation-pc-react';
import {
  requireBirdCoderProtectedToken,
  resolveBirdCoderProtectedToken,
  type BirdCoderProtectedTokenRequirementOptions as CoreBirdCoderProtectedTokenRequirementOptions,
  type BirdCoderProtectedTokenResolutionOptions as CoreBirdCoderProtectedTokenResolutionOptions,
} from '@sdkwork/birdcoder-core';
import {
  BIRDCODER_USER_CENTER_DEFINITION,
  type CreateBirdCoderUserCenterConfigOptions,
} from './user-center.ts';

const birdCoderUserCenterValidationDefinition =
  createSdkworkCanonicalUserCenterValidationDefinition({
    packageNames: ['@sdkwork/birdcoder-user'],
    title: 'BirdCoder User Center',
    userCenter: BIRDCODER_USER_CENTER_DEFINITION,
  });

export type BirdCoderUserCenterValidationDefinition =
  SdkworkCanonicalUserCenterValidationDefinition;
export type BirdCoderUserCenterValidationSnapshot = UserCenterValidationSnapshot;
export type BirdCoderUserCenterValidationInteropContract = UserCenterValidationInteropContract;
export type BirdCoderUserCenterValidationPluginDefinition = UserCenterValidationPluginDefinition;
export type BirdCoderUserCenterServerValidationPluginDefinition =
  UserCenterServerValidationPluginDefinition;
export type BirdCoderUserCenterValidationPreflightReport = UserCenterValidationPreflightReport;
export type BirdCoderProtectedTokenResolutionOptions =
  CoreBirdCoderProtectedTokenResolutionOptions;
export type BirdCoderProtectedTokenRequirementOptions =
  CoreBirdCoderProtectedTokenRequirementOptions;
export type CreateBirdCoderUserCenterValidationPluginDefinitionOptions =
  CreateSdkworkCanonicalUserCenterValidationPluginDefinitionOptions;
export type CreateBirdCoderUserCenterServerValidationPluginDefinitionOptions =
  CreateSdkworkCanonicalUserCenterServerValidationPluginDefinitionOptions;
export type CreateBirdCoderUserCenterValidationPreflightOptions =
  CreateSdkworkCanonicalUserCenterValidationPreflightOptions;

export const BIRDCODER_USER_CENTER_VALIDATION_SOURCE_PACKAGE =
  USER_CENTER_VALIDATION_SOURCE_PACKAGE_NAME;
export const BIRDCODER_USER_CENTER_VALIDATION_DEFINITION =
  birdCoderUserCenterValidationDefinition;
export const BIRDCODER_USER_CENTER_VALIDATION_PLUGIN_PACKAGES =
  birdCoderUserCenterValidationDefinition.packageNames;

export function createBirdCoderUserCenterValidationSnapshot(
  options: CreateBirdCoderUserCenterConfigOptions = {},
): BirdCoderUserCenterValidationSnapshot {
  return birdCoderUserCenterValidationDefinition.createSnapshot(options);
}

export function createBirdCoderUserCenterValidationInteropContract(
  options: CreateBirdCoderUserCenterConfigOptions = {},
): BirdCoderUserCenterValidationInteropContract {
  return birdCoderUserCenterValidationDefinition.createInteropContract(options);
}

export function createBirdCoderUserCenterValidationPluginDefinition(
  options: CreateBirdCoderUserCenterValidationPluginDefinitionOptions = {},
): BirdCoderUserCenterValidationPluginDefinition {
  return birdCoderUserCenterValidationDefinition.createPluginDefinition(options);
}

export function createBirdCoderUserCenterServerValidationPluginDefinition(
  options: CreateBirdCoderUserCenterServerValidationPluginDefinitionOptions = {},
): BirdCoderUserCenterServerValidationPluginDefinition {
  return birdCoderUserCenterValidationDefinition.createServerPluginDefinition(options);
}

export function createBirdCoderUserCenterValidationPreflightReport(
  options: CreateBirdCoderUserCenterValidationPreflightOptions,
): BirdCoderUserCenterValidationPreflightReport {
  return birdCoderUserCenterValidationDefinition.createPreflightReport(options);
}

export function assertBirdCoderUserCenterValidationPreflight(
  options: CreateBirdCoderUserCenterValidationPreflightOptions,
): BirdCoderUserCenterValidationPreflightReport {
  return birdCoderUserCenterValidationDefinition.assertPreflight(options);
}

export {
  requireBirdCoderProtectedToken,
  resolveBirdCoderProtectedToken,
};
