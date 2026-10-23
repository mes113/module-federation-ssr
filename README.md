# TanStack Start SSR Federation Lab — Rsbuild / Rspack

Три независимых TanStack Start приложения, оба на Rsbuild (Rspack). Vite не используется.

- Host: http://127.0.0.1:3005
- Catalog remote: http://127.0.0.1:3004
- Cart remote: http://127.0.0.1:3006
- Node: 22.18+, 24.11+ или 26+.

## Запуск

```sh
npm ci
npx playwright install chromium
npm run dev
```

В другом терминале:

```sh
npm test
npm run typecheck
```

Для production остановите dev, затем:

```sh
npm run build
npm run preview
```

В другом терминале снова `npm test`. Тесты используют запущенные приложения на фиксированных портах. Не запускайте dev и preview одновременно.

## Что проверяется

1. Четыре параллельных HTTP-запроса: remote `<article>` присутствует в исходном HTML host, до выполнения клиентского JavaScript. Start использует streaming SSR, поэтому remote может приходить в последующей части HTML-потока.
2. Remote CSS включён в HTML. Manifest содержит Node-контейнер `remoteEntry.ssr.cjs`.
3. Гидратация, интерактивный счётчик и общий React context host/remote.
4. Host GET server function вызывается из route loader во время SSR.
5. Remote-компонент вызывает переданную host POST server function; запрос идёт на host, результат обновляет UI.
6. Собственная remote server function: работает через host gateway и напрямую в standalone remote.
7. SSR loader host вызывает federated remote function; PID remote отличается от PID host.
8. Gateway отклоняет cross-origin запросы, неизвестные namespace передаёт обычному Start handler.

## Дополнительный плагин

Локальный пакет `packages/federation-server-functions` подключается поверх существующего federation adapter на host и обоих remote. Исходные зависимости не изменены. Browser RPC идёт через namespaced gateway host; SSR RPC идёт на backend remote. Реализация handler исключается из SSR-контейнера remote с помощью Start compiler.

Подключение и ограничения: [README плагина](packages/federation-server-functions/README.md). Используется внутренний API Start с жёсткой проверкой версии компилятора; это рабочий прототип, а не готовая production-интеграция сессий и middleware.

До подключения плагина прямой вызов remote function внутри host давал `Server function info not found`: это было воспроизведено на исходной конфигурации. Теперь интеграционный тест ожидает успешный ответ от remote backend.

POST-пример возвращает преобразованное значение; постоянного хранилища здесь нет.

## Файлы

- `apps/host/rsbuild.config.ts`, `apps/remote/rsbuild.config.ts`: `server: true` на host и обоих remote, host использует `loaded-first`.
- `apps/host/src/routes/index.tsx`: предварительная загрузка remote, CSS и SSR server function.
- `apps/host/src/probe.functions.ts`: GET и POST host server functions.
- `apps/remote/src/probe.functions.ts`: собственная remote POST server function.
- `apps/remote/src/components/StatusCard.tsx`: SSR, hydration, local state и оба RPC-сценария.
- `test/federation.test.mjs`: HTTP + Chromium интеграционные проверки.

## Источники

Основано на Rsbuild SSR примерах [module-federation/tanstack](https://github.com/module-federation/tanstack), upstream snapshot `fd1d6a0058e00de2d94e3751c4950c6b4d2c5b32`. Лицензия исходного примера — `LICENSE.upstream`.

[Server functions TanStack Start](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions) используют same-origin RPC. Поэтому remote-компонент не получает автоматически собственный RPC origin.

## Проверка нескольких remote и отказа backend

```sh
# Остановить обычные dev/preview: порты 3004, 3005, 3006 должны быть свободны.
npm run build
npm run test:remotes
npm run test:remotes:dev
```

Эти команды самостоятельно запускают три тестовых процесса и завершают их после проверки. Сначала выполняются обычные интеграционные тесты, затем останавливается только cart: его RPC должен вернуть 502, RPC catalog — 200, host продолжает SSR и гидратацию с сообщением `Cart backend unavailable`. После запуска cart проверяются SSR и RPC без перезапуска host. Проверка отказа выполняется после загрузки remote в host; холодный запуск host при недоступном remote отдельно не проверен.

Host параллельно вызывает функции catalog и cart при SSR. Chromium выполняет три пары параллельных browser RPC, проверяя владельцев функций и разные PID. В текущей production-сборке одинаковые ID функций разделяются namespace. Публичные ассеты обоих remote проверяются на отсутствие реализации backend handler.
