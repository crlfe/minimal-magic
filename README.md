# Tools for a Website with Minimal Magic

I learned my first HTML and CSS from reading the source of interesting websites,
but today that is only rarely possible. My previous website, like many others,
is compiled from source, bundled, pre-rendered, stripped, minified, and uploaded
as an unintelligible blob of static assets. This project is an effort to build
a fast, convenient, modern toolchain for websites that can be learned from.

## Usage

More documentation and features are coming soon. For the moment, try the
development server:

```
npm i
node minimal-magic serve docs
```

You can view the compiled docs
<a href="https://crlfe.github.io/minimal-magic">online</a>,
or build them yourself:

```
node minimal-magic build docs
cat out/index.html
```

## License and Warranty Disclaimer

Copyright 2019 Chris Wolfe

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this work except in compliance with the License.
You may obtain a copy of the License at
http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, work
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
