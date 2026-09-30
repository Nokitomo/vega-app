# usque Android binaries

Vega bundles `usque` v4.2.1, commit
`6aa03fc97d12848dce34eedbd187fb1077b5d1ea`, to provide the optional
app-scoped Cloudflare WARP proxy on Android.

Sources: https://github.com/Diniboy1123/usque/tree/v4.2.1

The `arm64-v8a` file is the upstream Android release binary. The
`armeabi-v7a` and `x86_64` files are reproducible cgo Android builds from the
same tag, using Go 1.26.3 and Android NDK 27.1.12297006 with API level 24.

SHA-256:

- `arm64-v8a/libusque.so`: `6C6C47CA3A0DCC5F0D6DF75C703476FA9AA18E692015D3236DD11751A6AD16CE`
- `armeabi-v7a/libusque.so`: `013755469273DAB9ECF23DCD9E38134972133B03028258CC4076D39AF720853D`
- `x86_64/libusque.so`: `FE3E7EA41C975CF04CBA7E3BF61E44EFD73EDBC897C38B9B2C9CE4447A3CD321`

`libusque.so` is an executable PIE named as a native library so Android keeps
it in the app's executable native-library directory. It must not be stripped.
See `LICENSE.md` for the upstream MIT license.
