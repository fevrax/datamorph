# [2.0.0](https://github.com/fevrax/datamorph/compare/v1.29.1...v2.0.0) (2026-10-26)


### Features

* **about:** link build version to automated releases ([dd8804d](https://github.com/fevrax/datamorph/commit/dd8804d16d75ad9dcc201b6f92d1ef4f5a2243bd))
* **editor:** add efficient JSON smart displays ([cf60265](https://github.com/fevrax/datamorph/commit/cf60265d29c19f5716fa8ac37831945efc21c2e1))
* **proto:** add field renumbering action ([052aa72](https://github.com/fevrax/datamorph/commit/052aa7250afda8bff12b45b5770113682004bc9a))
* rebrand as datamorph and detect data formats automatically ([3d3f451](https://github.com/fevrax/datamorph/commit/3d3f4517af1dac541940180cb41e5d7ee479ba66))
* Redesign UI ([7b71f4f](https://github.com/fevrax/datamorph/commit/7b71f4f945e0e2bb86909a98f87de56f4543a17f))
* refine toolbox layouts and editor settings ([1349f2d](https://github.com/fevrax/datamorph/commit/1349f2d07fe419c1788dcf436e9f18abda43f1c2))
* **toolbox:** add Protobuf renumbering diff tool ([5039e9c](https://github.com/fevrax/datamorph/commit/5039e9c640bf7580bf539e83849d5cb9319a8eb9))
* **workspace:** compact navigation and refine error diagnostics ([4338f9d](https://github.com/fevrax/datamorph/commit/4338f9dd2620c64ddb59c176407e1b3ff767fa15))
* **workspace:** move new-tab action to the left ([8e73d77](https://github.com/fevrax/datamorph/commit/8e73d779c8b0b44d72e77c200283ade7ffe85c7d))


### BREAKING CHANGES

* **workspace:** Workspace navigation now uses a compact tab bar instead of the breadcrumb header. Search is integrated into the tab bar, and the new-tab action is fixed before all tabs. Users and UI integrations must use the updated navigation layout.

## [1.29.1](https://github.com/fevrax/json-tools/compare/v1.29.0...v1.29.1) (2026-10-08)


### Bug Fixes

* harden data tools and AI proxy ([a35ccd7](https://github.com/fevrax/json-tools/commit/a35ccd7feaa8ed13704650a97b4544062fac4263))

# [1.29.0](https://github.com/fevrax/json-tools/compare/v1.28.0...v1.29.0) (2026-09-17)


### Bug Fixes

* sync PWA title bar with theme ([e94621f](https://github.com/fevrax/json-tools/commit/e94621fcb387b800c7e0207f2e98e926e0da92e2))


### Features

* PWA refactoring ([859205f](https://github.com/fevrax/json-tools/commit/859205f25a7310be81b30f21789ce6e3750c6bc4))

# [1.28.0](https://github.com/fevrax/json-tools/compare/v1.27.1...v1.28.0) (2026-08-30)


### Bug Fixes

* keep image preview decoration after paste ([8a9891e](https://github.com/fevrax/json-tools/commit/8a9891e916dfc01f38058ced1e49e20f7097a78b))
* 重构 JSON 字段命名转换 ([9374c9a](https://github.com/fevrax/json-tools/commit/9374c9a522e14801159d8749218dc03b8a0666a9))


### Features

* add bidirectional encoding converter ([d3b2893](https://github.com/fevrax/json-tools/commit/d3b289360357d13e26da9f023fb9f434702cea4e))

## [1.27.1](https://github.com/fevrax/json-tools/compare/v1.27.0...v1.27.1) (2026-08-16)


### Bug Fixes

* update js-yaml to 4.3.1 ([81b3ca4](https://github.com/fevrax/json-tools/commit/81b3ca45ef9b5a1d96f333ab916d1969c81c32e3))

# [1.27.0](https://github.com/fevrax/json-tools/compare/v1.26.0...v1.27.0) (2026-06-30)


### Features

* build docker images ([2773243](https://github.com/fevrax/json-tools/commit/27732435f91ec7acfbc90618457ee9ec51b7eff1))

# [1.26.0](https://github.com/fevrax/json-tools/compare/v1.25.0...v1.26.0) (2026-06-18)


### Bug Fixes

* optimize monaco editor validation ([a28b651](https://github.com/fevrax/json-tools/commit/a28b651627aba7abd6c5ba87bc045f89d31dea98))
* 在 uTools 环境下使用 shellOpenExternal 打开外链 ([fde7737](https://github.com/fevrax/json-tools/commit/fde7737da207a1485336328b62cc5b3b389bbba4))


### Features

* open toolbox tools in tabs ([988469c](https://github.com/fevrax/json-tools/commit/988469cef8a86b960680dee2eda674c37fd6d075))
* redesign settings page ([4d500ee](https://github.com/fevrax/json-tools/commit/4d500ee6d074c022aa7de115877d0c443cc1a872))

# [1.25.0](https://github.com/fevrax/json-tools/compare/v1.24.3...v1.25.0) (2026-06-04)


### Bug Fixes

* add optional chaining to prevent crash when switching from vanilla to monaco editor ([19a0cec](https://github.com/fevrax/json-tools/commit/19a0ceceb4d0da514de7f3b2767d7cb3bbcc1c3d))
* convert LosslessNumber to native number before passing to vanilla editor ([d9ec2f7](https://github.com/fevrax/json-tools/commit/d9ec2f795e8302e2270736a83756e4749e976305))


### Features

* add JSON key naming convention converter tool ([f2c020e](https://github.com/fevrax/json-tools/commit/f2c020ecc3bb7be518f7a8758bdd2468ec82e10a))

## [1.24.3](https://github.com/fevrax/json-tools/compare/v1.24.2...v1.24.3) (2026-05-14)


### Bug Fixes

* add responsive design for new tab creation menu ([6a9966c](https://github.com/fevrax/json-tools/commit/6a9966ce44052a8ceb1c7432ab84784d9fb62dd7))
* redesign table view welcome/error states for responsive layout ([826df66](https://github.com/fevrax/json-tools/commit/826df6660b6a522cbd8ccb2a5cc72ed1505b848c))

## [1.24.2](https://github.com/fevrax/json-tools/compare/v1.24.1...v1.24.2) (2026-05-14)


### Bug Fixes

* remove duplicate manifest link to resolve PWA syntax error ([e36b666](https://github.com/fevrax/json-tools/commit/e36b6666cb8f1ffe05cf2160f38dd859fccb3f33))
* resolve Monaco editor content rollback during typing ([575541f](https://github.com/fevrax/json-tools/commit/575541fb2a1d7de39f744eeae3ed3757982efa74))

## [1.24.1](https://github.com/fevrax/json-tools/compare/v1.24.0...v1.24.1) (2026-05-14)


### Bug Fixes

* resolve table view crash caused by TDZ and missing React key ([e1da7da](https://github.com/fevrax/json-tools/commit/e1da7dad41e5fc7ef4e3a2d64e3a0c2814cf22fb))

# [1.24.0](https://github.com/fevrax/json-tools/compare/v1.23.0...v1.24.0) (2026-05-12)


### Features

* add snake_case field conversion and update default model to DeepSeek V4 Pro ([2294dc1](https://github.com/fevrax/json-tools/commit/2294dc163977247360dbe1811e56b74fda5b09b9))

# [1.23.0](https://github.com/fevrax/json-tools/compare/v1.22.0...v1.23.0) (2026-05-12)


### Features

* update package.json ([9f20140](https://github.com/fevrax/json-tools/commit/9f20140d9b7747734924dda4cecb7fa37354453c))

# [1.22.0](https://github.com/fevrax/json-tools/compare/v1.21.0...v1.22.0) (2026-05-03)


### Bug Fixes

* resolve TS2322 type error in PromptContainer classNames ([a49e192](https://github.com/fevrax/json-tools/commit/a49e1922b99d844b7d54ed69e48fe50188c3c7a9))


### Features

* add Base64 import for new tab creation ([9d14a60](https://github.com/fevrax/json-tools/commit/9d14a6059a9b09931d0dc93cd8100d2178ed0f2a))
* add copy button to hover decoded content for base64/url/unicode ([5ddd05b](https://github.com/fevrax/json-tools/commit/5ddd05b85075eb013c4f3c828e0095d4cb35be48))
* add open-in-new-tab button to hover decoded content ([4765876](https://github.com/fevrax/json-tools/commit/4765876bdd583fe918bfe4c261579758ac4119ac))
* add table view search and column filter functionality ([780dad0](https://github.com/fevrax/json-tools/commit/780dad0cc052fb8f747785f6199fb74940e6628f))
* increase decorator recognition size limits for base64/url/unicode/image ([6cc6034](https://github.com/fevrax/json-tools/commit/6cc603416499ceda85c2ad9550d6aac5eb6b1817))
* Increase word count statistics ([1ca5d76](https://github.com/fevrax/json-tools/commit/1ca5d7648678c7f6e75f3c89dc6c999df92200f6))

# [1.21.0](https://github.com/fevrax/json-tools/compare/v1.20.0...v1.21.0) (2026-03-15)


### Bug Fixes

* local storage fix ([bf0bce8](https://github.com/fevrax/json-tools/commit/bf0bce84d00e75d85aadf9d32295317a703a1e9d))
* optimize Sidebar Style ([53973d6](https://github.com/fevrax/json-tools/commit/53973d631885f7cc2ac8222ee4f18709c6af8758))
* package.json ([fddfd5e](https://github.com/fevrax/json-tools/commit/fddfd5e909d8ae542581f7872ac151903f4ef734))


### Features

* add linux/arm64 docker build ([f5a20a1](https://github.com/fevrax/json-tools/commit/f5a20a11a6c973085c873b013ba804b292ce138c))

# [1.20.0](https://github.com/fevrax/json-tools/compare/v1.19.0...v1.20.0) (2026-03-15)


### Bug Fixes

* dev disable pwa ([9ba444c](https://github.com/fevrax/json-tools/commit/9ba444cb27221501dbdbcbf0295228b5615c1ab6))
* history list title change ([69c428f](https://github.com/fevrax/json-tools/commit/69c428f453bfa2f5467834e56d447244ad5f92a0))
* multiple window synchronization issue ([f094c90](https://github.com/fevrax/json-tools/commit/f094c902aa55ef7d7a8db274c2174e1bd9b70102))


### Features

* tab history ([47b881d](https://github.com/fevrax/json-tools/commit/47b881db282c848643777e6f5d48fb5f7063a379))

# [1.19.0](https://github.com/fevrax/json-tools/compare/v1.18.1...v1.19.0) (2026-03-10)


### Features

* refactor local storage ([eebdbe4](https://github.com/fevrax/json-tools/commit/eebdbe49390427ff0e7877bda5b358e810c7a764))

## [1.18.1](https://github.com/fevrax/json-tools/compare/v1.18.0...v1.18.1) (2025-12-30)


### Bug Fixes

* build docker ([2cd3edd](https://github.com/fevrax/json-tools/commit/2cd3edd2083fe9be6ce2960533e991056b83ff3c))

# [1.18.0](https://github.com/fevrax/json-tools/compare/v1.17.1...v1.18.0) (2025-12-28)


### Features

* automatically save historical data ([09e2e83](https://github.com/fevrax/json-tools/commit/09e2e837b0808854ee3651200df677f6d0b598ae))
* show history ([b2a05e2](https://github.com/fevrax/json-tools/commit/b2a05e258a31713d7e1110abe1a980564124ccf5))

## [1.17.1](https://github.com/fevrax/json-tools/compare/v1.17.0...v1.17.1) (2025-12-28)


### Bug Fixes

* save bug when setting ([e3a3610](https://github.com/fevrax/json-tools/commit/e3a36106eeaeeb5d1f16c2b9d4494122d923eaa7))

# [1.17.0](https://github.com/fevrax/json-tools/compare/v1.16.1...v1.17.0) (2025-12-07)


### Features

* pwa install ([a291c57](https://github.com/fevrax/json-tools/commit/a291c5721e6aa67a112b8b5c44988901a20a4446))

## [1.16.1](https://github.com/fevrax/json-tools/compare/v1.16.0...v1.16.1) (2025-11-23)


### Bug Fixes

* content cannot be sent to AI. ([0da2536](https://github.com/fevrax/json-tools/commit/0da253627c64c31bebde3c154c49b8e3653ac8be))

# [1.16.0](https://github.com/fevrax/json-tools/compare/v1.15.3...v1.16.0) (2025-11-23)


### Bug Fixes

* Fix json prompt ui error ([bb4a24d](https://github.com/fevrax/json-tools/commit/bb4a24dc6e95092b91878a17598b6c91eef99d99))
* json query lossless-json ([1b639e0](https://github.com/fevrax/json-tools/commit/1b639e02b7c5e3d73538fb368109cee75d70c255))


### Features

* utools input json automatic formatting ([58f38d8](https://github.com/fevrax/json-tools/commit/58f38d85e8551b98c163766c274f5532f0907630))

## [1.15.3](https://github.com/fevrax/json-tools/compare/v1.15.2...v1.15.3) (2025-11-09)


### Bug Fixes

* format fix ([ed6b801](https://github.com/fevrax/json-tools/commit/ed6b801360dafcef8405d612f6ac0c23432fc7f9))

## [1.15.2](https://github.com/fevrax/json-tools/compare/v1.15.1...v1.15.2) (2025-11-09)


### Bug Fixes

* delete unused reference ([a494978](https://github.com/fevrax/json-tools/commit/a4949789489ebfc48fc3e845ad78dadb0c08ce3e))
* diff json image preview ([276afc4](https://github.com/fevrax/json-tools/commit/276afc49eaf1b7ab00543486bc577b2a274b0953))
* format fix ([498f2dd](https://github.com/fevrax/json-tools/commit/498f2dd67ecb3c3d46d6bce88b67651e5a3fcc3c))
* image preview ([5a22b2c](https://github.com/fevrax/json-tools/commit/5a22b2c51715b2fd9027648bc7364347d393924a))

# [1.15.0](https://github.com/fevrax/json-tools/compare/v1.14.0...v1.15.0) (2025-11-02)


### Bug Fixes

* operation button UI optimization ([6a18687](https://github.com/fevrax/json-tools/commit/6a18687101cebfd94afd189c8b1428fb6ef88348))
* sort the json ([c896cef](https://github.com/fevrax/json-tools/commit/c896cef130bf30e3463e88d825ae35851e5dace7))
* tab scroll ([b13cbea](https://github.com/fevrax/json-tools/commit/b13cbeaaa59a854d93ad05522db9c1a600acdbf1))


### Features

* operation button ([4b21eca](https://github.com/fevrax/json-tools/commit/4b21ecad36aff9b7a35b8e0961a32e8a7122a776))

# [1.14.0](https://github.com/fevrax/json-tools/compare/v1.13.0...v1.14.0) (2025-11-02)


### Bug Fixes

* improve decoration performance ([2e4a572](https://github.com/fevrax/json-tools/commit/2e4a57241f7dceeb60bd20e1d6458d3ccfb5e5f2))
* improve utools performance ([055abd8](https://github.com/fevrax/json-tools/commit/055abd82d98f6bd8583228f463b2169b3e43d492))


### Features

* json parse big integer ([eca7ba6](https://github.com/fevrax/json-tools/commit/eca7ba60f8e0a2bb3f4fb431cdc4cbbe96d90ad8))

# [1.13.0](https://github.com/fevrax/json-tools/compare/v1.12.0...v1.13.0) (2025-11-01)


### Features

* auto format ([59d28bd](https://github.com/fevrax/json-tools/commit/59d28bd3000c6f4b1a0c97579b5eee900e8aca71))

# [1.12.0](https://github.com/fevrax/json-tools/compare/v1.11.0...v1.12.0) (2025-09-21)


### Bug Fixes

* utools enter event ([c5fa79c](https://github.com/fevrax/json-tools/commit/c5fa79ce47fb919589a71d4cbf0d1d12495f9a31))
* utools enter event editor update content ([657f33b](https://github.com/fevrax/json-tools/commit/657f33bab0ce8e6999105e24e8f3517c9769501d))


### Features

* custom app font size ([6939808](https://github.com/fevrax/json-tools/commit/69398083ce3033eedb1b4bc78d90e6813df151ff))
* json query ([736caeb](https://github.com/fevrax/json-tools/commit/736caeb73247409c69341b67dd5e7a9951ef016f))
* json query document ([c221f2f](https://github.com/fevrax/json-tools/commit/c221f2fb7ac2aaaf32d4f4bfb3e44bceb1ac2692))

# [1.11.0](https://github.com/fevrax/json-tools/compare/v1.10.0...v1.11.0) (2025-09-20)


### Bug Fixes

* clear decorators ([7cbc13c](https://github.com/fevrax/json-tools/commit/7cbc13c3fe5d148e5cb1342f67ef53edc3593fd4))


### Features

* add close tab keyboard shortcut ([71cf649](https://github.com/fevrax/json-tools/commit/71cf649a068624b2b1764800c554e89deb65bbe8))
* add new tab keyboard shortcut ([77f113a](https://github.com/fevrax/json-tools/commit/77f113a0a2537646651cb9ed6c52328409a271d7))
* convert to dart ([158bc29](https://github.com/fevrax/json-tools/commit/158bc299fc1d3731e5dd58e196b45ca89c94fb98))
* dataFormatConverter windows move ([d661072](https://github.com/fevrax/json-tools/commit/d661072df2c30b06c94d8ef9c77f3a60336a7aa7))
* double add tab create new tab ([5d82e65](https://github.com/fevrax/json-tools/commit/5d82e65464516bd80841821605484b190d99f624))
* edit change tabSize ([82401e5](https://github.com/fevrax/json-tools/commit/82401e59cfc6a00b1eadd8950aafb16102d3a52c))
* jsonTypeConverter windows move ([df583b5](https://github.com/fevrax/json-tools/commit/df583b5d931677f5370508def6639a2fb92ac10d))

# [1.10.0](https://github.com/fevrax/json-tools/compare/v1.9.1...v1.10.0) (2025-09-19)


### Bug Fixes

* docker name ([7b6ac6a](https://github.com/fevrax/json-tools/commit/7b6ac6a3b37e341006cda12c21ff56bb1b9da573))
* **editor:** 测试4 ([b0d96a5](https://github.com/fevrax/json-tools/commit/b0d96a5fc5c070b6ae1bfb5ba94bcc1fec8a3ecb))
* github relase ([ac61fb3](https://github.com/fevrax/json-tools/commit/ac61fb38f3b761b7ddfc966e63fa90bdaac04c17))
* github relase1 ([d7276e2](https://github.com/fevrax/json-tools/commit/d7276e2e4ca6dfb0e375c8dd7f147eccec0c94e8))
* github relase2 ([fcb6012](https://github.com/fevrax/json-tools/commit/fcb60126ea45b3f10a9e82f1f779fe7c100010f2))
* release ([275a744](https://github.com/fevrax/json-tools/commit/275a744e92167272cd30ec4675679300500806ae))
* release tag ([08756f6](https://github.com/fevrax/json-tools/commit/08756f6490f4537dd67231c71f4584b2c92b48e3))
* 测试5 ([5b7f0fd](https://github.com/fevrax/json-tools/commit/5b7f0fd0bb0e1f1720ffd7b47ee3f72d618174c1))
* 测试6 ([25076f8](https://github.com/fevrax/json-tools/commit/25076f8b4b8752777c41ac18973b08ab53bacac8))


### Features

* **editor:** 测试 ([d34ab49](https://github.com/fevrax/json-tools/commit/d34ab498924b76380d2e68425a0ec3db290509d8))
* **editor:** 测试2 ([4b0690d](https://github.com/fevrax/json-tools/commit/4b0690d9f56276112971fd9e234055de6b7c0401))
* **editor:** 测试3 ([4929428](https://github.com/fevrax/json-tools/commit/4929428584c98b0c6de4e230a1b25675a39b63ea))
* github relase ([5f6f464](https://github.com/fevrax/json-tools/commit/5f6f464b0ceb370de0caa8e8b7b398c116018da5))
* release ([b291bb6](https://github.com/fevrax/json-tools/commit/b291bb67773fbd42a459ebb70c31685b1c080bbd))
* release config ([60423d9](https://github.com/fevrax/json-tools/commit/60423d97c18bf834ff1f15eab375cca8b66d0988))
* release tag ([2efeb6c](https://github.com/fevrax/json-tools/commit/2efeb6cbb8723932769e6dd45d7fbce3964ff698))
* 测试6 ([d8b25b5](https://github.com/fevrax/json-tools/commit/d8b25b57b7bfeab8d5670cffa96ce16dd96c4ee8))

## [1.9.1](https://github.com/fevrax/json-tools/compare/v1.9.0...v1.9.1) (2025-07-01)


### Bug Fixes

* 文档说明 ([8a86f0e](https://github.com/fevrax/json-tools/commit/8a86f0e4c7c2bc5c725778322106547d188b567a))
* 自动发布版本配置 ([d5d7a7a](https://github.com/fevrax/json-tools/commit/d5d7a7a154f5cac6e3cb1ac284f93d78ed303eaf))

# [1.9.0](https://github.com/fevrax/json-tools/compare/v1.8.2...v1.9.0) (2025-07-01)


### Features

* 解码器默认显示在字符后面，最大100字符 ([5f895c7](https://github.com/fevrax/json-tools/commit/5f895c7a82a7b8531dfe6675bfabdd67da9a7d30))

## [1.8.2](https://github.com/fevrax/json-tools/compare/v1.8.1...v1.8.2) (2025-06-30)


### Bug Fixes

* test docker push1 ([b378f4c](https://github.com/fevrax/json-tools/commit/b378f4c6c61b2815d8e8913587e6f5d6b8573d35))

## [1.8.1](https://github.com/fevrax/json-tools/compare/v1.8.0...v1.8.1) (2025-06-30)


### Bug Fixes

* test docker push ([a4526bd](https://github.com/fevrax/json-tools/commit/a4526bdddf77e30baaabbae48454f7e0f0a0343f))

# [1.8.0](https://github.com/fevrax/json-tools/compare/v1.7.0...v1.8.0) (2025-06-30)


### Features

* auto github docker push ([18a5e1a](https://github.com/fevrax/json-tools/commit/18a5e1ab79817d0ec47c1633cb3d200691dd652b))

# [1.7.0](https://github.com/fevrax/json-tools/compare/v1.6.5...v1.7.0) (2025-06-30)


### Bug Fixes

* base64 解码器说明调整 ([c1e1009](https://github.com/fevrax/json-tools/commit/c1e1009a14dcf2824ca7d6a13faf42bfe3415674))
* diff编辑器重复渲染悬浮设置 ([b9034f5](https://github.com/fevrax/json-tools/commit/b9034f551694922b5572da77a39021e8a9b1f9f4))
* unicode 解码器说明调整 ([2a746e2](https://github.com/fevrax/json-tools/commit/2a746e2e70c48bec4f34307d6a59cee8b0bb35e1))
* 优化unicode 解码器 ([95cdc56](https://github.com/fevrax/json-tools/commit/95cdc5658167ebbea6b4ff3c0c04d2d25aef99ad))
* 修复菜单下拉按钮异常问题 ([03cbffc](https://github.com/fevrax/json-tools/commit/03cbffc451e6e5be45ca3b09ede9ba8703b22416))
* 修复菜单下拉按钮异常问题 ([e3460dc](https://github.com/fevrax/json-tools/commit/e3460dcfcaa739207962e0ca902f64b33cdee150))
* 删除创建tab背景模糊 ([e4ac3ff](https://github.com/fevrax/json-tools/commit/e4ac3ff7477499918a557fb429e21b917db4049a))
* 命名相关 ([10fa2bc](https://github.com/fevrax/json-tools/commit/10fa2bc00ec512bd353b3d48a4effbec96d18ed1))
* 字符编码提供者重复注册问题 ([8335ecd](https://github.com/fevrax/json-tools/commit/8335ecdb220388143731030627ebf34be6095644))
* 字符编码提供者重复注册问题 ([e694629](https://github.com/fevrax/json-tools/commit/e694629b74d1835e90552bf31755208dbc7ebbf7))
* 字符编码提供者重复注册问题 ([c13a842](https://github.com/fevrax/json-tools/commit/c13a842b786525b893edb95037460bb88fdf384a))


### Features

* auto github release ([2317e9b](https://github.com/fevrax/json-tools/commit/2317e9b4dffe3c17fee60b02d98630f5fe307a34))
* base64 解码支持 ([f7f6093](https://github.com/fevrax/json-tools/commit/f7f60932550726780b18a490fe97f1c80493e18c))
* diff 编辑器注册解码器 ([9a78e78](https://github.com/fevrax/json-tools/commit/9a78e78d9c3bf66a827b91feb0ea91c352ad285c))
* diff 解码器 urldecode 解码器 ([1220c57](https://github.com/fevrax/json-tools/commit/1220c57ae9a6b68fbd4f4262b9a1c8a09baad6ff))
* urldecode 解码器 ([5faf4d5](https://github.com/fevrax/json-tools/commit/5faf4d5d40de71d941d44d2e15ae38b704e48266))
* 解码器全局设置 ([b941827](https://github.com/fevrax/json-tools/commit/b94182766ce508f11880ec46d27aa6469c92e244))
* 解码器全局设置 ([573844a](https://github.com/fevrax/json-tools/commit/573844a8242773a33079828207f3e485e3c07295))
* 默认使用本地存储 ([f9b2b1f](https://github.com/fevrax/json-tools/commit/f9b2b1fd83c357b3af664080c9d792ade9efa45d))
