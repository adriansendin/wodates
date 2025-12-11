import { ApiClient } from './apiClient';
import { Result } from '../../domain/Result';
import { DomainError } from '../../domain/errors/DomainError';
import { UserPhoto } from '../../domain/models/UserPhoto';

export class UserPhotoApi {
  constructor(private readonly apiClient: ApiClient) {}

  async listUserPhotos(
    token: string
  ): Promise<Result<UserPhoto[], DomainError>> {
    return this.apiClient
      .get<{ photos: UserPhoto[] }>('/users/me/photos', token)
      .then((result) => {
        if (result.success) {
          return { success: true, data: result.data.photos } as Result<
            UserPhoto[],
            DomainError
          >;
        }
        return result;
      });
  }

  async addUserPhoto(
    formData: FormData,
    token: string
  ): Promise<Result<UserPhoto, DomainError>> {
    return this.apiClient
      .post<{ photo: UserPhoto }>('/users/me/photos', formData, token)
      .then((result) => {
        if (result.success) {
          return { success: true, data: result.data.photo } as Result<
            UserPhoto,
            DomainError
          >;
        }
        return result;
      });
  }

  async setMainPhoto(
    photoId: string,
    token: string
  ): Promise<Result<UserPhoto, DomainError>> {
    return this.apiClient
      .put<{ photo: UserPhoto }>(`/users/me/photos/${photoId}/main`, {}, token)
      .then((result) => {
        if (result.success) {
          return { success: true, data: result.data.photo } as Result<
            UserPhoto,
            DomainError
          >;
        }
        return result;
      });
  }

  async deleteUserPhoto(
    photoId: string,
    token: string
  ): Promise<Result<void, DomainError>> {
    return this.apiClient.delete<void>(`/users/me/photos/${photoId}`, token);
  }
}







