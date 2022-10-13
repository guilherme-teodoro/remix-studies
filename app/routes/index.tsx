import * as t from "io-ts";
import { record, keys } from "fp-ts/lib/Record";
import { faker } from "@faker-js/faker";
import { pipe } from "fp-ts/lib/pipeable";
import { chain } from "fp-ts/lib/Either";
import { format, parseISO, isValid } from "date-fns";
import { Decimal } from "decimal.js";
import * as tPromise from "io-ts-promise";
import { redirect, superjson, useSuperLoaderData } from "../utils";

interface ArrayType extends t.ArrayType<HasArbitrary> {}
interface RecordType extends t.DictionaryType<t.StringType, HasArbitrary> {}
interface StructType
  extends t.InterfaceType<{ [K: string]: t.TypeOf<HasArbitrary> }> {}
interface ExactType extends t.ExactType<HasArbitrary> {}
interface TupleType extends t.TupleType<Array<HasArbitrary>> {}
interface PartialType extends t.PartialType<Record<string, HasArbitrary>> {}
interface UnionType extends t.UnionType<Array<HasArbitrary>> {}
interface IntersectionType extends t.IntersectionType<Array<HasArbitrary>> {}
interface BrandedType extends t.RefinementType<HasArbitrary> {}

export type HasArbitrary =
  | t.UnknownType
  | t.UndefinedType
  | t.NullType
  | t.VoidType
  | t.StringType
  | t.NumberType
  | t.BooleanType
  | t.KeyofType<any>
  | t.LiteralType<any>
  | ArrayType
  | RecordType
  | StructType
  | ExactType
  | PartialType
  | TupleType
  | UnionType
  | IntersectionType
  | BrandedType;

function getProps(
  codec: t.InterfaceType<any> | t.ExactType<any> | t.PartialType<any>
): t.Props {
  switch (codec._tag) {
    case "InterfaceType":
    case "PartialType":
      return codec.props;
    case "ExactType":
      return getProps(codec.type);
  }
}

export function generate<T extends HasArbitrary>(codec: T): t.TypeOf<T> {
  const type: HasArbitrary = codec as any;

  if (type.name === "DateFromStringISO") {
    return faker.date.past().toISOString();
  }

  if (type.name === "Uuid") {
    return faker.datatype.uuid();
  }

  if (type.name === "CurrencyFromString") {
    return faker.datatype.float({ precision: 0.01 });
  }

  switch (type._tag) {
    // case "UnknownType":
    //   return fc.anything() as any;
    // case "UndefinedType":
    // case "VoidType":
    //   return fc.constant(undefined) as any;
    // case "NullType":
    //   return fc.constant(null) as any;
    case "StringType":
      return faker.datatype.string();
    case "NumberType":
      return faker.datatype.number();
    case "BooleanType":
      return faker.datatype.boolean();
    // case "KeyofType":
    //   return fc.oneof(...keys(type.keys).map(fc.constant)) as any;
    // case "LiteralType":
    //   return fc.constant(type.value);
    case "ArrayType":
      const range = Math.floor(Math.random() * 10);
      return [...Array(range).keys()].map(() => generate(type.type) as any);
    // case "DictionaryType":
    //   return fc.dictionary(
    //     generate(type.domain),
    //     generate(type.codomain)
    //   ) as any;
    case "InterfaceType":
    case "PartialType":
    case "ExactType":
      return record.map(getProps(type), generate as any) as any;
    // case "TupleType":
    //   return (fc.tuple as any)(...type.types.map(generate));
    // case "UnionType":
    //   return fc.oneof(...type.types.map(generate)) as any;
    // case "IntersectionType":
    //   const isObjectIntersection = objectTypes.includes(type.types[0]._tag);
    //   return isObjectIntersection
    //     ? (fc.tuple as any)(...type.types.map((t) => generate(t)))
    //         .map((values: Array<object>) => Object.assign({}, ...values))
    //         .filter(type.is)
    //     : fc.oneof(...type.types.map((t) => generate(t))).filter(type.is);
    case "RefinementType":
      return generate(type.type).filter(type.predicate) as any;
  }
}

const Uuid = new t.Type<String, String, unknown>(
  "Uuid",
  (u): u is String => u instanceof String,
  (u, c) => t.string.validate(u, c),
  (a) => a
);

export const CurrencyFromString = new t.Type<Decimal, number, unknown>(
  "CurrencyFromString",
  (u): u is Decimal => u instanceof Decimal,
  (s, c) => {
    return pipe(
      t.number.validate(s, c),
      chain((s) => {
        try {
          const n = new Decimal(s);
          return t.success(n);
        } catch {
          return t.failure(s, c);
        }
      })
    );
  },
  (a) => a.toNumber()
);

const DateFromISOString = new t.Type<Date, string, unknown>(
  "DateFromStringISO",
  (u): u is Date => u instanceof Date,
  (s, c) => {
    return pipe(
      t.string.validate(s, c),
      chain((s) => {
        const parsedDate = parseISO(s);
        return isValid(parsedDate) ? t.success(parsedDate) : t.failure(s, c);
      })
    );
  },
  (date) => format(date, "yyyy-MM-dd")
);

const QuotationCodec = t.type({
  id: Uuid,
  createdAt: DateFromISOString,
  productComboId: Uuid,
  totalAmount: CurrencyFromString,
  validUntil: DateFromISOString,
  productQuotations: t.array(
    t.type({
      amountNetOfIof: CurrencyFromString,
      totalAmount: CurrencyFromString,
      iofAmount: CurrencyFromString,
    })
  ),
});

type Quotation = t.TypeOf<typeof QuotationCodec>;

export const loader = async () => {
  const quotation = await tPromise.decode(
    QuotationCodec,
    generate(QuotationCodec)
  );

  return superjson(quotation);
};

const formatCurrency = (d: Decimal) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(d.toNumber());
};

export default function Index() {
  const quotation = useSuperLoaderData() as Quotation;

  return (
    <div className="container mx-auto mt-10">
      <h1 className="mb-5 text-lg">Quotation</h1>
      <pre className="mb-5">
        <div>id: {quotation.id}</div>
        <div>createdAt: {format(quotation.createdAt, "dd MMM yyyy")}</div>
        <div>validUntil: {format(quotation.validUntil, "dd MMM yyyy")}</div>
        <div>totalAmount: {formatCurrency(quotation.totalAmount)}</div>
      </pre>
      <div>
        <h2 className="mb-4 text-lg">productQuotations:</h2>{" "}
        <div className="space-y-4 rounded">
          {quotation.productQuotations.map((product, idx) => (
            <pre className="bg-gray-100" key={idx}>
              <div>totalAmount: {formatCurrency(product.totalAmount)}</div>
              <div>iofAmount: {formatCurrency(product.iofAmount)}</div>
              <div>iofAmount: {formatCurrency(product.amountNetOfIof)}</div>
              <hr />
            </pre>
          ))}
        </div>
      </div>
    </div>
  );
}
