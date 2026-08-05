@EndUserText.label: 'Cotizacion de vuelo con descuento por volumen'
@ObjectModel.query.implementedBy: 'ABAP:ZCL1_FLIGHT_QUOTE_QUERY' 
define custom entity ZCE1_FLIGHT_QUOTE
{
  key AirlineID    : abap.char(3);
  key ConnectionID : abap.char(4);
  key FlightDate   : abap.dats;
  key Passengers   : abap.int4;
      BasePrice    : abap.dec(15,2);
      CurrencyCode : abap.cuky;
      DiscountPct  : abap.dec(5,2);
      NetPrice     : abap.dec(15,2);
      Reason       : abap.char(120);
}
