// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AbortSignalLike } from "@azure/abort-controller";
import { OperationOptions } from "@azure/core-client";
import {
  KeyVaultCertificateWithPolicy,
  CreateCertificateOptions,
  CertificatePolicy,
  GetCertificateOptions,
  GetPlainCertificateOperationOptions,
  CancelCertificateOperationOptions,
} from "../../certificatesModels.js";
import { CertificateOperation } from "../../generated/models/index.js";
import {
  KeyVaultCertificatePollOperation,
  KeyVaultCertificatePollOperationState,
} from "../keyVaultCertificatePoller.js";
import { KeyVaultClient } from "../../generated/keyVaultClient.js";
import {
  getCertificateOperationFromCoreOperation,
  getCertificateWithPolicyFromCertificateBundle,
  toCoreAttributes,
  toCorePolicy,
} from "../../transformations.js";
import { tracingClient } from "../../tracing.js";

/**
 * The public representation of the CreateCertificatePoller operation state.
 */
export type CreateCertificateState =
  KeyVaultCertificatePollOperationState<KeyVaultCertificateWithPolicy>;

/**
 * An interface representing the state of a create certificate's poll operation
 */
export interface CreateCertificatePollOperationState
  extends KeyVaultCertificatePollOperationState<KeyVaultCertificateWithPolicy> {
  /**
   * The policy of the certificate.
   */
  certificatePolicy?: CertificatePolicy;
  /**
   * Optional parameters sent to createCertificates
   */
  createCertificateOptions: CreateCertificateOptions;
  /**
   * The operation of the certificate
   */
  certificateOperation?: CertificateOperation;
}

/**
 * An interface representing a create certificate's poll operation
 */
export class CreateCertificatePollOperation extends KeyVaultCertificatePollOperation<
  CreateCertificatePollOperationState,
  KeyVaultCertificateWithPolicy
> {
  constructor(
    public state: CreateCertificatePollOperationState,
    private vaultUrl: string,
    private client: KeyVaultClient,
    private operationOptions: OperationOptions = {},
  ) {
    super(state);
  }

  /**
   * Creates a new certificate. If this is the first version, the certificate resource is created. This operation requires the certificates/create permission.
   */
  private createCertificate(
    certificateName: string,
    certificatePolicy: CertificatePolicy,
    options: CreateCertificateOptions = {},
  ): Promise<KeyVaultCertificateWithPolicy> {
    return tracingClient.withSpan(
      "CreateCertificatePoller.createCertificate",
      options,
      async (updatedOptions) => {
        const id = options.id;
        const certificateAttributes = toCoreAttributes(options);
        const corePolicy = toCorePolicy(id, certificatePolicy, certificateAttributes);
        const result = await this.client.createCertificate(this.vaultUrl, certificateName, {
          ...updatedOptions,
          certificatePolicy: corePolicy,
          certificateAttributes,
        });

        return getCertificateWithPolicyFromCertificateBundle(result);
      },
    );
  }

  /**
   * Gets the latest information available from a specific certificate, including the certificate's policy. This operation requires the certificates/get permission.
   */
  private getCertificate(
    certificateName: string,
    options: GetCertificateOptions = {},
  ): Promise<KeyVaultCertificateWithPolicy> {
    return tracingClient.withSpan(
      "CreateCertificatePoller.getCertificate",
      options,
      async (updatedOptions) => {
        const result = await this.client.getCertificate(
          this.vaultUrl,
          certificateName,
          "",
          updatedOptions,
        );

        return getCertificateWithPolicyFromCertificateBundle(result);
      },
    );
  }

  /**
   * Gets the certificate operation.
   */
  private getPlainCertificateOperation(
    certificateName: string,
    options: GetPlainCertificateOperationOptions = {},
  ): Promise<CertificateOperation> {
    return tracingClient.withSpan(
      "CreateCertificatePoller.getPlainCertificateOperation",
      options,
      async (updatedOptions) => {
        let parsedBody: any;
        await this.client.getCertificateOperation(this.vaultUrl, certificateName, {
          ...updatedOptions,
          onResponse: (response) => {
            parsedBody = response.parsedBody;
          },
        });
        return getCertificateOperationFromCoreOperation(certificateName, this.vaultUrl, parsedBody);
      },
    );
  }

  /**
   * Cancels a certificate creation operation that is already in progress. This operation requires the certificates/update permission.
   */
  private cancelCertificateOperation(
    certificateName: string,
    options: CancelCertificateOperationOptions = {},
  ): Promise<CertificateOperation> {
    return tracingClient.withSpan(
      "CreateCertificatePoller.cancelCertificateOperation",
      options,
      async (updatedOptions) => {
        let parsedBody: any;
        await this.client.updateCertificateOperation(this.vaultUrl, certificateName, true, {
          ...updatedOptions,
          onResponse: (response) => {
            parsedBody = response.parsedBody;
          },
        });
        return getCertificateOperationFromCoreOperation(certificateName, this.vaultUrl, parsedBody);
      },
    );
  }

  /**
   * Reaches to the service and updates the create certificate's poll operation.
   */
  async update(
    this: CreateCertificatePollOperation,
    options: {
      abortSignal?: AbortSignalLike;
      fireProgress?: (state: CreateCertificatePollOperationState) => void;
    } = {},
  ): Promise<CreateCertificatePollOperation> {
    const state = this.state;
    const { certificateName, certificatePolicy, createCertificateOptions } = state;

    if (options.abortSignal) {
      this.operationOptions.abortSignal = options.abortSignal;
      createCertificateOptions.abortSignal = options.abortSignal;
    }

    if (!state.isStarted) {
      state.isStarted = true;
      state.result = await this.createCertificate(
        certificateName,
        certificatePolicy!,
        createCertificateOptions,
      );
      this.state.certificateOperation = await this.getPlainCertificateOperation(
        certificateName,
        this.operationOptions,
      );
    } else if (!state.isCompleted) {
      this.state.certificateOperation = await this.getPlainCertificateOperation(
        certificateName,
        this.operationOptions,
      );
    }

    if (state.certificateOperation && state.certificateOperation.status !== "inProgress") {
      state.isCompleted = true;
      state.result = await this.getCertificate(certificateName, this.operationOptions);
      if (state.certificateOperation.error) {
        state.error = new Error(state.certificateOperation.error.message);
      }
    }

    return this;
  }

  /**
   * Reaches to the service and cancels the certificate's operation, also updating the certificate's poll operation
   */
  async cancel(
    this: CreateCertificatePollOperation,
    options: { abortSignal?: AbortSignal } = {},
  ): Promise<CreateCertificatePollOperation> {
    const state = this.state;
    const { certificateName } = state;

    if (options.abortSignal) {
      this.operationOptions.abortSignal = options.abortSignal;
    }

    state.certificateOperation = await this.cancelCertificateOperation(
      certificateName,
      this.operationOptions,
    );

    this.state.isCancelled = true;
    return this;
  }
}
